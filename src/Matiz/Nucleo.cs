using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading;
using System.Windows;
using System.Windows.Threading;

namespace Matiz;

/// <summary>Junta tudo: configuração, efeito, atalho, bandeja e janela, e responde às mensagens da interface.</summary>
internal sealed class Nucleo
{
    private readonly Application _app;
    private readonly Config _cfg;
    private readonly Efeito _efeito;
    private readonly Teclas _teclas;
    private readonly Bandeja _bandeja;
    private readonly DispatcherTimer _salvar;
    private readonly Canal.Servidor _canal;
    private Process? _processoJanela;
    private bool _janelaAtiva;
    private bool _atalhoOk = true;
    private bool _saindo;

    public Config Config => _cfg;

    public Nucleo(Application app, bool soBandeja, string? marca, bool falhou)
    {
        _app = app;
        _cfg = Config.Carregar();
        _efeito = new Efeito(_cfg);
        _efeito.Mudou += () =>
        {
            _canal?.Enviar(Status());
            _bandeja?.Atualizar(_cfg.Ligado, _efeito.Situacao);
        };
        _teclas = new Teclas();
        _teclas.Apertou += () =>
        {
            DefinirLigado(!_cfg.Ligado);
            Log.Escrever($"atalho: filtro {(_cfg.Ligado ? "ligado" : "desligado")}");
        };
        _atalhoOk = _teclas.Registrar(_cfg.Atalho);
        string? avisoAtalho = null;
        if (!_atalhoOk && _cfg.Atalho.Mods == Nativo.MOD_ALT && _cfg.Atalho.Tecla == 0x72)
        {
            // Alt + F3 é o atalho dos filtros do overlay da NVIDIA; ocupado, cai para um parecido
            foreach (var mods in new[] { Nativo.MOD_CONTROL | Nativo.MOD_ALT, Nativo.MOD_ALT | Nativo.MOD_SHIFT, Nativo.MOD_CONTROL | Nativo.MOD_SHIFT })
            {
                var alt = new Atalho { Mods = mods, Tecla = 0x72 };
                if (!_teclas.Registrar(alt)) continue;
                _cfg.Atalho = alt;
                _atalhoOk = true;
                _cfg.Salvar();
                avisoAtalho = $"Alt + F3 já é usado por outro programa (provavelmente o overlay da NVIDIA), então o atalho do Matiz ficou {Teclas.Nome(alt)}. Dá para trocar nas opções.";
                break;
            }
        }
        if (Atualizador.Instalado()) Inicio.Definir(_cfg.IniciarComWindows);

        _bandeja = new Bandeja(this);
        _salvar = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(600) };
        _salvar.Tick += (_, _) => { _salvar.Stop(); _cfg.Salvar(); };

        _canal = new Canal.Servidor(app.Dispatcher, Receber, AoMudarConexao);
        _efeito.Aplicar();
        Mem("memória ao iniciar");
        Escutar(@"Local\Matiz.Abrir", Abrir);
        Escutar(@"Local\Matiz.Sair", Sair);

        if (marca != null)
        {
            try { File.WriteAllText(marca, Atualizador.Info().versao); } catch { }
        }
        if (!soBandeja || _cfg.Novo) Abrir();
        if (falhou) _bandeja.Avisar("A atualização não abriu, então o Matiz voltou para a versão anterior.");
        if (avisoAtalho != null) _bandeja.Avisar(avisoAtalho);
        else if (!_atalhoOk) _bandeja.Avisar($"O atalho {Teclas.Nome(_cfg.Atalho)} já está em uso por outro programa. Troque nas opções.");
    }

    private static void Mem(string etapa) => Log.Escrever($"{etapa}: {System.Diagnostics.Process.GetCurrentProcess().PrivateMemorySize64 / 1048576} MB");

    private void Escutar(string nome, Action acao)
    {
        var ev = new EventWaitHandle(false, EventResetMode.AutoReset, nome);
        var t = new Thread(() =>
        {
            while (true)
            {
                ev.WaitOne();
                _app.Dispatcher.BeginInvoke(acao);
            }
        }) { IsBackground = true, Name = "escuta " + nome };
        t.Start();
    }

    // ---------- janela e bandeja ----------

    public void Abrir()
    {
        if (_saindo) return;
        // o clique na bandeja é deste processo; deixa a janela (outro processo) vir para a frente
        Nativo.AllowSetForegroundWindow(-1);
        if (_canal.Conectado || (_processoJanela != null && !_processoJanela.HasExited))
        {
            if (EventWaitHandle.TryOpenExisting(Canal.EVENTO_MOSTRAR, out var ev)) { ev.Set(); ev.Dispose(); }
            return;
        }
        try
        {
            _processoJanela = Process.Start(new ProcessStartInfo(Environment.ProcessPath!, "--janela") { UseShellExecute = false });
        }
        catch (Exception e) { Log.Escrever("não abriu a janela: " + e.Message); }
    }

    private void AoMudarConexao(bool conectado)
    {
        if (conectado) return;
        // janela fechou: o processo dela já saiu e levou a memória junto
        _janelaAtiva = false;
        _efeito.PausaJanela = false;
        _efeito.TesteSegurado = false;
    }

    public void DefinirLigado(bool ligado)
    {
        _cfg.Ligado = ligado;
        _efeito.Aplicar();
        Agendar();
    }

    public void Sair()
    {
        if (_saindo) return;
        _saindo = true;
        _salvar.Stop();
        _cfg.Salvar();
        _canal.Enviar(new JsonObject { ["tipo"] = "fechar" });
        _efeito.Dispose();
        _teclas.Dispose();
        _bandeja.Dispose();
        _app.Shutdown();
    }

    /// <summary>Windows desligando ou erro fatal: devolve a tela antes de tudo.</summary>
    public void Emergencia()
    {
        try { _cfg.Salvar(); } catch { }
        try { _efeito.Dispose(); } catch { }
    }

    private void Agendar()
    {
        _salvar.Stop();
        _salvar.Start();
    }

    // ---------- mensagens ----------

    private JsonObject Status()
    {
        return new JsonObject
        {
            ["tipo"] = "status",
            ["ligado"] = _cfg.Ligado,
            ["situacao"] = _efeito.Situacao,
            ["mag"] = _efeito.MagOk,
            ["telas"] = JsonSerializer.SerializeToNode(_efeito.Telas().Select(t => new
            {
                dispositivo = t.Dispositivo, nome = t.Nome, principal = t.Principal, alvo = t.Alvo, limite = t.Limite, erro = t.Erro,
            })),
        };
    }

    private JsonObject Estado()
    {
        var (versao, repo) = Atualizador.Info();
        var s = Status();
        s["tipo"] = "estado";
        s["versao"] = versao;
        s["repositorio"] = repo;
        s["dev"] = Atualizador.Desenvolvimento();
        s["instalado"] = Atualizador.Instalado();
        s["pausarComJanela"] = _cfg.PausarComJanela;
        s["iniciarComWindows"] = _cfg.IniciarComWindows;
        s["monitores"] = JsonSerializer.SerializeToNode(_cfg.Monitores);
        s["atalho"] = new JsonObject
        {
            ["mods"] = _cfg.Atalho.Mods, ["tecla"] = _cfg.Atalho.Tecla, ["nome"] = Teclas.Nome(_cfg.Atalho), ["ok"] = _atalhoOk,
        };
        s["nvidia"] = new JsonObject { ["disponivel"] = _efeito.Nvidia.Disponivel, ["motivo"] = _efeito.Nvidia.Motivo };
        s["interface"] = _cfg.Interface?.DeepClone();
        return s;
    }

    public async void Receber(string json)
    {
        JsonNode? m;
        try { m = JsonNode.Parse(json); } catch { return; }
        if (m == null) return;
        var tipo = m["tipo"]?.GetValue<string>();
        try
        {
            switch (tipo)
            {
                case "pronto":
                    _canal.Enviar(Estado());
                    break;

                case "aplicar":
                    var saida = m["saida"]?.Deserialize<Saida>();
                    if (saida != null && saida.Valida()) _cfg.Saida = saida;
                    _cfg.Interface = m["interface"]?.DeepClone();
                    _efeito.Aplicar();
                    Agendar();
                    break;

                case "ligado":
                    DefinirLigado(m["valor"]?.GetValue<bool>() ?? true);
                    break;

                case "janela":
                    _janelaAtiva = m["ativa"]?.GetValue<bool>() ?? false;
                    _efeito.PausaJanela = _cfg.PausarComJanela && _janelaAtiva;
                    if (!_janelaAtiva) _efeito.TesteSegurado = false;
                    break;

                case "teste":
                    _efeito.TesteSegurado = m["valor"]?.GetValue<bool>() ?? false;
                    break;

                case "opcao":
                    Opcao(m["chave"]?.GetValue<string>() ?? "", m["valor"]);
                    break;

                case "atualizacao-checar":
                    var info = await Atualizador.Checar();
                    info["tipo"] = "atualizacao";
                    _canal.Enviar(info);
                    break;

                case "atualizacao-instalar":
                    _canal.Enviar(new JsonObject { ["tipo"] = "atualizacao-andamento", ["texto"] = "Baixando e conferindo o pacote…" });
                    try
                    {
                        var (pasta, versao) = await Atualizador.Baixar();
                        Atualizador.EntregarTroca(pasta, versao);
                        Sair();
                    }
                    catch (Exception e)
                    {
                        _canal.Enviar(new JsonObject { ["tipo"] = "atualizacao-erro", ["texto"] = e.Message });
                    }
                    break;

                case "abrir-link":
                    var url = m["url"]?.GetValue<string>() ?? "";
                    if (url.StartsWith("https://github.com/")) Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
                    break;

                case "sair":
                    Sair();
                    break;
            }
        }
        catch (Exception e)
        {
            Log.Escrever($"mensagem {tipo}: {e}");
        }
    }

    private void Opcao(string chave, JsonNode? valor)
    {
        switch (chave)
        {
            case "pausarComJanela":
                _cfg.PausarComJanela = valor?.GetValue<bool>() ?? true;
                _efeito.PausaJanela = _cfg.PausarComJanela && _janelaAtiva;
                break;
            case "iniciarComWindows":
                _cfg.IniciarComWindows = valor?.GetValue<bool>() ?? true;
                if (Atualizador.Instalado()) Inicio.Definir(_cfg.IniciarComWindows);
                break;
            case "monitores":
                _cfg.Monitores = valor?.Deserialize<System.Collections.Generic.List<string>>() ?? new();
                _efeito.Aplicar();
                break;
            case "atalho":
                var a = valor?.Deserialize<Atalho>() ?? new Atalho();
                var antigo = _cfg.Atalho;
                _cfg.Atalho = a;
                _atalhoOk = _teclas.Registrar(a);
                if (!_atalhoOk)
                {
                    // não deixa o app sem atalho nenhum por causa de uma combinação ocupada
                    _cfg.Atalho = antigo;
                    _teclas.Registrar(antigo);
                    _canal.Enviar(new JsonObject { ["tipo"] = "aviso", ["texto"] = $"{Teclas.Nome(a)} já está em uso por outro programa. Ficou o {Teclas.Nome(antigo)}." });
                    _atalhoOk = true;
                }
                break;
        }
        Agendar();
        _canal.Enviar(Estado());
    }
}
