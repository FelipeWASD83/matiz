using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;

namespace Matiz;

/// <summary>O que o filtro manda aplicar, já calculado pela interface (a conta mora só no motor.js).</summary>
public sealed class Saida
{
    [JsonPropertyName("matriz")] public float[] Matriz { get; set; } = Identidade();
    [JsonPropertyName("rampa")] public double[] Rampa { get; set; } = RampaNeutra();
    // 0 a 100 (0 = padrão do driver); null = não mexer na vibração
    [JsonPropertyName("vibracao")] public int? Vibracao { get; set; }

    public static float[] Identidade() => new float[]
    {
        1, 0, 0, 0, 0,
        0, 1, 0, 0, 0,
        0, 0, 1, 0, 0,
        0, 0, 0, 1, 0,
        0, 0, 0, 0, 1,
    };

    public static double[] RampaNeutra()
    {
        var r = new double[768];
        for (int c = 0; c < 3; c++)
            for (int i = 0; i < 256; i++) r[c * 256 + i] = i / 255.0;
        return r;
    }

    public bool Valida() => Matriz is { Length: 25 } && Rampa is { Length: 768 };
}

public sealed class Atalho
{
    [JsonPropertyName("mods")] public int Mods { get; set; } = Nativo.MOD_ALT;
    [JsonPropertyName("tecla")] public int Tecla { get; set; } = 0x72; // F3
}

public sealed class Config
{
    [JsonPropertyName("ligado")] public bool Ligado { get; set; } = true;
    [JsonPropertyName("pausarComJanela")] public bool PausarComJanela { get; set; } = true;
    [JsonPropertyName("iniciarComWindows")] public bool IniciarComWindows { get; set; } = true;
    // telas que recebem a rampa de gama; vazia = todas
    [JsonPropertyName("monitores")] public List<string> Monitores { get; set; } = new();
    [JsonPropertyName("atalho")] public Atalho Atalho { get; set; } = new();
    [JsonPropertyName("saida")] public Saida Saida { get; set; } = new();
    // estado da interface (estilo, ajustes, presets salvos); o C# só guarda e devolve
    [JsonPropertyName("interface")] public JsonNode? Interface { get; set; }

    public static readonly string Pasta = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "matiz");
    private static string Arquivo => Path.Combine(Pasta, "config.json");

    public static readonly JsonSerializerOptions Json = new() { WriteIndented = true };

    public bool Novo { get; private set; }

    public static Config Carregar()
    {
        try
        {
            if (File.Exists(Arquivo))
            {
                var c = JsonSerializer.Deserialize<Config>(File.ReadAllText(Arquivo), Json);
                if (c != null)
                {
                    if (c.Saida == null || !c.Saida.Valida()) c.Saida = new Saida();
                    c.Monitores ??= new();
                    c.Atalho ??= new();
                    return c;
                }
            }
        }
        catch (Exception e)
        {
            // config estragada não pode impedir o app de abrir: guarda a ruim e começa do zero
            try { File.Copy(Arquivo, Arquivo + ".estragada", true); } catch { }
            Log.Escrever("config ilegível: " + e.Message);
        }
        return new Config { Novo = true };
    }

    public void Salvar()
    {
        try
        {
            Directory.CreateDirectory(Pasta);
            var tmp = Arquivo + ".tmp";
            File.WriteAllText(tmp, JsonSerializer.Serialize(this, Json));
            File.Move(tmp, Arquivo, true);
        }
        catch (Exception e)
        {
            Log.Escrever("não salvou a config: " + e.Message);
        }
    }
}

internal static class Log
{
    public static void Escrever(string texto)
    {
        try
        {
            Directory.CreateDirectory(Config.Pasta);
            var arq = Path.Combine(Config.Pasta, "matiz.log");
            if (File.Exists(arq) && new FileInfo(arq).Length > 512 * 1024) File.Delete(arq);
            File.AppendAllText(arq, $"{DateTime.Now:yyyy-MM-dd HH:mm:ss}  {texto}{Environment.NewLine}");
        }
        catch { }
    }
}
