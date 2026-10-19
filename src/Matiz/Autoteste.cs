using System;
using System.IO;
using System.Linq;
using System.Text;

namespace Matiz;

/// <summary>
/// "Matiz.exe --autoteste": aplica um filtro moderado por um instante, confere lendo de volta
/// da API de Ampliação e da placa de vídeo, desliga, confere que voltou ao original e sai.
/// Resultado em %APPDATA%\matiz\autoteste.txt; código de saída 0 = tudo certo.
/// </summary>
internal static class Autoteste
{
    public static int Rodar()
    {
        var r = new StringBuilder();
        bool ok = true;
        void Anotar(bool passou, string texto)
        {
            ok &= passou;
            r.AppendLine($"{(passou ? "ok  " : "FALHOU")}  {texto}");
        }

        var cfg = new Config { Ligado = true, Monitores = new() };
        var saida = new Saida();
        // saturação 1.3 e um contraste leve: dá para ver, não assusta
        const float s = 1.3f;
        float[] m3 =
        {
            0.2126f + 0.7874f * s, 0.7152f - 0.7152f * s, 0.0722f - 0.0722f * s,
            0.2126f - 0.2126f * s, 0.7152f + 0.2848f * s, 0.0722f - 0.0722f * s,
            0.2126f - 0.2126f * s, 0.7152f - 0.7152f * s, 0.0722f + 0.9278f * s,
        };
        for (int i = 0; i < 3; i++)
            for (int j = 0; j < 3; j++) saida.Matriz[j * 5 + i] = m3[i * 3 + j];
        for (int c = 0; c < 3; c++)
            for (int i = 0; i < 256; i++)
            {
                double x = i / 255.0;
                saida.Rampa[c * 256 + i] = x + 0.25 * (x * x * (3 - 2 * x) - x);
            }
        cfg.Saida = saida;

        using (var efeito = new Efeito(cfg))
        {
            Anotar(efeito.MagOk, "API de Ampliação iniciou");
            r.AppendLine($"      NVIDIA: {(efeito.Nvidia.Disponivel ? "vibração disponível" : efeito.Nvidia.Motivo)}");
            if (efeito.Nvidia.Disponivel)
                foreach (var t in efeito.Nvidia.Telas())
                {
                    Anotar(efeito.Nvidia.Definir(t.Handle, t.Atual), $"NVAPI respondeu em {t.Dispositivo} (nível {t.Atual} de {t.Minimo}..{t.Maximo}, regravado igual)");
                }

            efeito.Aplicar();
            System.Threading.Thread.Sleep(400);
            Anotar(MatrizIgual(saida.Matriz), "matriz de cor aplicada e lida de volta igual");
            foreach (var t in efeito.Telas())
                Anotar(!t.Erro && t.Limite > 0.999, $"curva em {t.Dispositivo} ({t.Nome}{(t.Principal ? ", principal" : "")}): " +
                       (t.Erro ? "a placa recusou" : $"aceita {t.Limite:P0}"));

            cfg.Ligado = false;
            efeito.Aplicar();
            System.Threading.Thread.Sleep(200);
            Anotar(MatrizIgual(Saida.Identidade()), "desligado: matriz voltou à identidade");
        }

        r.Insert(0, $"Autoteste do Matiz {Atualizador.Info().versao} em {DateTime.Now:dd/MM/yyyy HH:mm:ss}{Environment.NewLine}");
        r.AppendLine(ok ? "RESULTADO: tudo certo" : "RESULTADO: algo falhou");
        Directory.CreateDirectory(Config.Pasta);
        File.WriteAllText(Path.Combine(Config.Pasta, "autoteste.txt"), r.ToString(), new UTF8Encoding(false));
        return ok ? 0 : 1;
    }

    private static unsafe bool MatrizIgual(float[] esperado)
    {
        // a API só devolve a matriz enquanto o processo está inicializado (o Efeito ainda está vivo aqui)
        if (!Nativo.MagGetFullscreenColorEffect(out var atual)) return false;
        for (int i = 0; i < 25; i++)
            if (Math.Abs(atual.transform[i] - esperado[i]) > 1e-4f) return false;
        return true;
    }
}
