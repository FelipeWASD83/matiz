using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Windows.Threading;
using WinScreen = System.Windows.Forms.Screen;

namespace Matiz;

/// <summary>
/// Aplica o filtro na tela inteira, fora de qualquer jogo:
/// a matriz de cor vai para o compositor do Windows (API de Ampliação, vale em todas as telas)
/// e as curvas vão para a rampa de gama da placa de vídeo (uma por tela).
/// Guarda a rampa e a vibração originais em disco antes de mexer, para devolver tudo
/// mesmo se o app tiver caído na sessão anterior.
/// </summary>
internal sealed class Efeito : IDisposable
{
    private sealed class Originais
    {
        [JsonPropertyName("sujo")] public bool Sujo { get; set; }
        [JsonPropertyName("gama")] public Dictionary<string, ushort[]> Gama { get; set; } = new();
        [JsonPropertyName("dvc")] public Dictionary<string, int> Dvc { get; set; } = new();
    }

    public sealed record TelaInfo(string Dispositivo, string Nome, bool Principal, bool Alvo, double Limite, bool Erro);

    private static string ArquivoOriginais => Path.Combine(Config.Pasta, "originais.json");
    private const int TOLERANCIA = 768; // o driver arredonda a rampa (10 bits); diferença maior que isso = recusada

    private readonly Config _cfg;
    private readonly Nvapi _nv;
    private readonly bool _magOk;
    private readonly Originais _orig;
    private readonly Dictionary<string, ushort[]> _esperado = new();
    private readonly Dictionary<string, double> _limite = new();
    private readonly HashSet<string> _erro = new();
    private readonly DispatcherTimer _vigia;
    private float[] _matrizAtual = Saida.Identidade();
    private bool _pausaJanela, _teste, _descartado;

    public event Action? Mudou;

    public Nvapi Nvidia => _nv;
    public bool MagOk => _magOk;

    public Efeito(Config cfg)
    {
        _cfg = cfg;
        _magOk = Nativo.MagInitialize();
        if (!_magOk) Log.Escrever("MagInitialize falhou");
        _nv = new Nvapi();
        _orig = CarregarOriginais();
        CapturarOriginais();
        Microsoft.Win32.SystemEvents.DisplaySettingsChanged += AoMudarTelas;
        _vigia = new DispatcherTimer { Interval = TimeSpan.FromSeconds(2) };
        _vigia.Tick += (_, _) => Vigiar();
        _vigia.Start();
    }

    public bool PausaJanela
    {
        get => _pausaJanela;
        set { if (_pausaJanela == value) return; _pausaJanela = value; Aplicar(); }
    }

    public bool TesteSegurado
    {
        get => _teste;
        set { if (_teste == value) return; _teste = value; Aplicar(); }
    }

    public bool Ativo => _cfg.Ligado && (!_pausaJanela || _teste);

    public string Situacao =>
        !_cfg.Ligado ? "desligado" : (_pausaJanela && !_teste) ? "pausado" : "ativo";

    public List<TelaInfo> Telas()
    {
        return WinScreen.AllScreens
            .OrderByDescending(s => s.Primary).ThenBy(s => s.DeviceName)
            .Select(s => new TelaInfo(
                s.DeviceName,
                $"{s.Bounds.Width} × {s.Bounds.Height}",
                s.Primary,
                EhAlvo(s.DeviceName),
                _limite.TryGetValue(s.DeviceName, out var l) ? l : 1,
                _erro.Contains(s.DeviceName)))
            .ToList();
    }

    private bool EhAlvo(string dispositivo) => _cfg.Monitores.Count == 0 || _cfg.Monitores.Contains(dispositivo);

    // ---------- aplicar ----------

    public void Aplicar()
    {
        if (_descartado) return;
        var s = _cfg.Saida;
        if (Ativo)
        {
            DefinirMatriz(s.Matriz);
            foreach (var tela in WinScreen.AllScreens)
            {
                var dev = tela.DeviceName;
                if (!_orig.Gama.TryGetValue(dev, out var original)) continue;
                if (EhAlvo(dev)) DefinirRampaVerificada(dev, Compor(original, s.Rampa));
                else DefinirRampa(dev, original, out _);
            }
            AplicarVibracao(s.Vibracao);
            MarcarSujo(true);
        }
        else
        {
            Restaurar(false);
        }
        Mudou?.Invoke();
    }

    /// <summary>Devolve a tela como estava. Com <paramref name="fim"/>, solta a API de Ampliação.</summary>
    public void Restaurar(bool fim)
    {
        DefinirMatriz(Saida.Identidade());
        foreach (var (dev, original) in _orig.Gama)
        {
            DefinirRampa(dev, original, out _);
            _esperado.Remove(dev);
        }
        _limite.Clear();
        AplicarVibracao(null);
        MarcarSujo(false);
        if (fim && _magOk) Nativo.MagUninitialize();
    }

    private unsafe void DefinirMatriz(float[] m)
    {
        if (!_magOk) return;
        var efeito = new Nativo.MAGCOLOREFFECT();
        for (int i = 0; i < 25; i++) efeito.transform[i] = m[i];
        if (!Nativo.MagSetFullscreenColorEffect(ref efeito)) Log.Escrever("MagSetFullscreenColorEffect falhou");
        _matrizAtual = (float[])m.Clone();
    }

    private unsafe bool MatrizConfere()
    {
        if (!_magOk || !Nativo.MagGetFullscreenColorEffect(out var atual)) return true;
        for (int i = 0; i < 25; i++)
            if (Math.Abs(atual.transform[i] - _matrizAtual[i]) > 1e-4f) return false;
        return true;
    }

    /// <summary>Curva pedida (0..1) passada por cima da rampa original da tela (que pode ter calibração).</summary>
    private static ushort[] Compor(ushort[] original, double[] curva)
    {
        var r = new ushort[768];
        for (int c = 0; c < 3; c++)
        {
            for (int i = 0; i < 256; i++)
            {
                double x = Math.Clamp(curva[c * 256 + i], 0, 1) * 255;
                int a = (int)Math.Floor(x);
                int b = Math.Min(255, a + 1);
                double f = x - a;
                double v = original[c * 256 + a] * (1 - f) + original[c * 256 + b] * f;
                r[c * 256 + i] = (ushort)Math.Clamp(Math.Round(v), 0, 65535);
            }
        }
        return r;
    }

    private static IntPtr AbrirDC(string dev)
    {
        var dc = Nativo.CreateDC(null, dev, IntPtr.Zero, IntPtr.Zero);
        if (dc == IntPtr.Zero) dc = Nativo.CreateDC("DISPLAY", dev, IntPtr.Zero, IntPtr.Zero);
        return dc;
    }

    private static unsafe ushort[]? LerRampa(string dev)
    {
        var dc = AbrirDC(dev);
        if (dc == IntPtr.Zero) return null;
        try
        {
            if (!Nativo.GetDeviceGammaRamp(dc, out var r)) return null;
            var v = new ushort[768];
            for (int i = 0; i < 768; i++) v[i] = r.valores[i];
            return v;
        }
        finally { Nativo.DeleteDC(dc); }
    }

    /// <summary>Grava a rampa e confere lendo de volta: o Windows recusa rampa "extrema" sem dar erro.</summary>
    private static unsafe bool DefinirRampa(string dev, ushort[] valores, out bool aceita)
    {
        aceita = false;
        var dc = AbrirDC(dev);
        if (dc == IntPtr.Zero) return false;
        try
        {
            var r = new Nativo.RAMP();
            for (int i = 0; i < 768; i++) r.valores[i] = valores[i];
            if (!Nativo.SetDeviceGammaRamp(dc, ref r)) return false;
            if (!Nativo.GetDeviceGammaRamp(dc, out var lida)) { aceita = true; return true; }
            int pior = 0;
            for (int i = 0; i < 768; i++) pior = Math.Max(pior, Math.Abs(lida.valores[i] - valores[i]));
            aceita = pior <= TOLERANCIA;
            return true;
        }
        finally { Nativo.DeleteDC(dc); }
    }

    private void DefinirRampaVerificada(string dev, ushort[] alvo)
    {
        var original = _orig.Gama[dev];
        if (!DefinirRampa(dev, alvo, out var aceita))
        {
            _erro.Add(dev);
            return;
        }
        _erro.Remove(dev);
        if (aceita)
        {
            _esperado[dev] = alvo;
            _limite[dev] = 1;
            return;
        }
        // recusada: procura a maior parte da curva que o Windows aceita
        double baixo = 0, alto = 1;
        ushort[]? melhor = null;
        for (int passo = 0; passo < 7; passo++)
        {
            double t = (baixo + alto) / 2;
            var mistura = Misturar(original, alvo, t);
            DefinirRampa(dev, mistura, out var ok);
            if (ok) { baixo = t; melhor = mistura; } else alto = t;
        }
        if (melhor == null)
        {
            DefinirRampa(dev, original, out _);
            _esperado.Remove(dev);
            _limite[dev] = 0;
        }
        else
        {
            DefinirRampa(dev, melhor, out _);
            _esperado[dev] = melhor;
            _limite[dev] = baixo;
        }
        Log.Escrever($"{dev}: o Windows recusou a curva inteira; aplicada {baixo:P0}");
    }

    private static ushort[] Misturar(ushort[] a, ushort[] b, double t)
    {
        var r = new ushort[768];
        for (int i = 0; i < 768; i++) r[i] = (ushort)Math.Round(a[i] + (b[i] - a[i]) * t);
        return r;
    }

    private void AplicarVibracao(int? valor)
    {
        if (!_nv.Disponivel) return;
        foreach (var t in _nv.Telas())
        {
            if (!_orig.Dvc.ContainsKey(t.Dispositivo)) _orig.Dvc[t.Dispositivo] = t.Atual;
            int alvo;
            if (valor is int v && EhAlvo(t.Dispositivo))
                alvo = (int)Math.Round(Math.Clamp(v, 0, 100) / 100.0 * t.Maximo);
            else
                alvo = _orig.Dvc[t.Dispositivo];
            if (alvo != t.Atual) _nv.Definir(t.Handle, alvo);
        }
    }

    // ---------- originais ----------

    private static Originais CarregarOriginais()
    {
        try
        {
            if (File.Exists(ArquivoOriginais))
                return JsonSerializer.Deserialize<Originais>(File.ReadAllText(ArquivoOriginais)) ?? new Originais();
        }
        catch (Exception e) { Log.Escrever("originais ilegíveis: " + e.Message); }
        return new Originais();
    }

    private void SalvarOriginais()
    {
        try
        {
            Directory.CreateDirectory(Config.Pasta);
            File.WriteAllText(ArquivoOriginais, JsonSerializer.Serialize(_orig));
        }
        catch (Exception e) { Log.Escrever("não salvou os originais: " + e.Message); }
    }

    /// <summary>
    /// Se a sessão anterior terminou limpa, o que está na tela agora é o original de verdade.
    /// Se caiu com o filtro aplicado (sujo), vale o que ficou guardado.
    /// </summary>
    private void CapturarOriginais()
    {
        bool sujo = _orig.Sujo;
        foreach (var tela in WinScreen.AllScreens)
        {
            var dev = tela.DeviceName;
            if (sujo && _orig.Gama.TryGetValue(dev, out var guardada) && guardada.Length == 768) continue;
            var atual = LerRampa(dev);
            if (atual != null) _orig.Gama[dev] = atual;
        }
        if (!sujo && _nv.Disponivel)
        {
            _orig.Dvc.Clear();
            foreach (var t in _nv.Telas()) _orig.Dvc[t.Dispositivo] = t.Atual;
        }
        SalvarOriginais();
    }

    private void MarcarSujo(bool sujo)
    {
        if (_orig.Sujo == sujo) return;
        _orig.Sujo = sujo;
        SalvarOriginais();
    }

    // ---------- vigia ----------

    private void Vigiar()
    {
        if (!Ativo || _descartado) return;
        bool mexeu = false;
        if (!MatrizConfere())
        {
            DefinirMatriz(_cfg.Saida.Matriz);
            mexeu = true;
        }
        foreach (var (dev, esperado) in _esperado.ToList())
        {
            var atual = LerRampa(dev);
            if (atual == null) continue;
            int pior = 0;
            for (int i = 0; i < 768; i++) pior = Math.Max(pior, Math.Abs(atual[i] - esperado[i]));
            if (pior > TOLERANCIA)
            {
                // jogo ou driver trocou a rampa: põe a nossa de volta
                DefinirRampa(dev, esperado, out _);
                mexeu = true;
            }
        }
        if (mexeu) Log.Escrever("filtro reaplicado (alguém mexeu na tela)");
    }

    private void AoMudarTelas(object? sender, EventArgs e)
    {
        System.Windows.Application.Current?.Dispatcher.BeginInvoke(async () =>
        {
            await System.Threading.Tasks.Task.Delay(800);
            foreach (var tela in WinScreen.AllScreens)
            {
                if (_orig.Gama.ContainsKey(tela.DeviceName)) continue;
                var atual = LerRampa(tela.DeviceName);
                if (atual != null) _orig.Gama[tela.DeviceName] = atual;
            }
            SalvarOriginais();
            Aplicar();
        });
    }

    public void Dispose()
    {
        if (_descartado) return;
        _vigia.Stop();
        Microsoft.Win32.SystemEvents.DisplaySettingsChanged -= AoMudarTelas;
        Restaurar(true);
        _descartado = true;
    }
}
