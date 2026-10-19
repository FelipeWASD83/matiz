using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.Tasks;

namespace Matiz;

/// <summary>
/// Atualização pelas releases do GitHub, no modelo do clave:
/// confere a release mais nova, baixa o .zip, confere o SHA-256, e entrega a troca para o
/// atualizar.ps1, que espera o app fechar, guarda a versão atual, troca a pasta e abre a nova.
/// Se a nova não der sinal de vida em 25 s, o script devolve a anterior.
/// Os dados (%APPDATA%\matiz) nunca entram no pacote nem são tocados.
/// </summary>
internal static class Atualizador
{
    public static readonly string Base = AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
    public static string Pasta => Path.Combine(Config.Pasta, "atualizacao");

    public static (string versao, string repositorio) Info()
    {
        try
        {
            var j = JsonNode.Parse(File.ReadAllText(Path.Combine(Base, "versao.json")));
            return (j?["versao"]?.GetValue<string>() ?? "0.0.0", j?["repositorio"]?.GetValue<string>() ?? "");
        }
        catch { return ("0.0.0", ""); }
    }

    public static readonly string PastaInstalacao =
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "Matiz");

    /// <summary>É a cópia que o instalar.ps1 põe em %LOCALAPPDATA%\Programs\Matiz (só ela entra no "iniciar com o Windows").</summary>
    public static bool Instalado() => string.Equals(Path.GetFullPath(Base), Path.GetFullPath(PastaInstalacao), StringComparison.OrdinalIgnoreCase);

    /// <summary>Rodando de dentro da pasta do projeto (tem .git acima): atualiza pelo git, não por aqui.</summary>
    public static bool Desenvolvimento()
    {
        var d = new DirectoryInfo(Base);
        while (d != null)
        {
            if (Directory.Exists(Path.Combine(d.FullName, ".git"))) return true;
            d = d.Parent;
        }
        return false;
    }

    private static int[] Tupla(string v)
    {
        var p = (v ?? "0").TrimStart('v', 'V').Split('.')
            .Select(x => int.TryParse(new string(x.TakeWhile(char.IsDigit).ToArray()), out var n) ? n : 0).ToList();
        while (p.Count < 3) p.Add(0);
        return p.Take(3).ToArray();
    }

    public static bool MaisNova(string a, string b)
    {
        var x = Tupla(a);
        var y = Tupla(b);
        for (int i = 0; i < 3; i++) if (x[i] != y[i]) return x[i] > y[i];
        return false;
    }

    private static HttpClient Cliente(string versao)
    {
        var c = new HttpClient { Timeout = TimeSpan.FromSeconds(120) };
        c.DefaultRequestHeaders.UserAgent.ParseAdd($"Matiz/{versao}");
        c.DefaultRequestHeaders.Add("X-GitHub-Api-Version", "2022-11-28");
        return c;
    }

    public static async Task<JsonObject> Checar()
    {
        var (atual, repo) = Info();
        var r = new JsonObject { ["atual"] = atual, ["dev"] = Desenvolvimento() };
        if (string.IsNullOrEmpty(repo)) { r["erro"] = "Sem repositório configurado no versao.json."; return r; }
        try
        {
            using var http = Cliente(atual);
            http.DefaultRequestHeaders.Accept.ParseAdd("application/vnd.github+json");
            var resp = await http.GetAsync($"https://api.github.com/repos/{repo}/releases/latest");
            if ((int)resp.StatusCode == 404) { r["erro"] = "Ainda não tem nenhuma versão publicada no GitHub."; return r; }
            if (!resp.IsSuccessStatusCode) { r["erro"] = $"O GitHub respondeu {(int)resp.StatusCode}."; return r; }
            var rel = JsonNode.Parse(await resp.Content.ReadAsStringAsync())!;
            var ultima = (rel["tag_name"]?.GetValue<string>() ?? "").TrimStart('v', 'V');
            var asset = rel["assets"]?.AsArray().FirstOrDefault(a => (a?["name"]?.GetValue<string>() ?? "").EndsWith(".zip"));
            r["ultima"] = ultima;
            r["nova"] = MaisNova(ultima, atual);
            r["notas"] = rel["body"]?.GetValue<string>() ?? "";
            r["pagina"] = rel["html_url"]?.GetValue<string>() ?? "";
            if (asset != null)
            {
                r["url"] = asset["browser_download_url"]?.GetValue<string>();
                r["digest"] = asset["digest"]?.GetValue<string>();
                r["tamanho"] = asset["size"]?.GetValue<long>() ?? 0;
            }
            else r["erro"] = "A release não tem o pacote .zip.";
        }
        catch (Exception e) { r["erro"] = "Sem conexão com o GitHub (" + e.Message + ")."; }
        return r;
    }

    /// <summary>Baixa, confere e prepara. Devolve o caminho da pasta nova ou lança com a explicação.</summary>
    public static async Task<(string pasta, string versao)> Baixar()
    {
        if (Desenvolvimento()) throw new InvalidOperationException("Esta é a cópia de desenvolvimento (pasta do projeto). Atualize pelo git e rode o instalar.ps1.");
        var info = await Checar();
        if (info["erro"] != null) throw new InvalidOperationException(info["erro"]!.GetValue<string>());
        if (info["nova"]?.GetValue<bool>() != true) throw new InvalidOperationException("Você já está na versão mais nova.");
        var versao = info["ultima"]!.GetValue<string>();
        var url = info["url"]!.GetValue<string>();
        var digest = info["digest"]?.GetValue<string>() ?? "";

        Directory.CreateDirectory(Pasta);
        var zip = Path.Combine(Pasta, "pacote.zip");
        var novo = Path.Combine(Pasta, "novo");
        if (Directory.Exists(novo)) Directory.Delete(novo, true);

        using (var http = Cliente(Info().versao))
        await using (var arq = File.Create(zip))
        {
            using var resp = await http.GetAsync(url, HttpCompletionOption.ResponseHeadersRead);
            resp.EnsureSuccessStatusCode();
            await resp.Content.CopyToAsync(arq);
        }

        string hash;
        await using (var arq = File.OpenRead(zip)) hash = Convert.ToHexString(await SHA256.HashDataAsync(arq)).ToLowerInvariant();
        if (!digest.StartsWith("sha256:"))
        {
            File.Delete(zip);
            throw new InvalidOperationException("O GitHub não informou o SHA-256 do pacote; sem conferir, não instalo.");
        }
        if (hash != digest[7..].ToLowerInvariant())
        {
            File.Delete(zip);
            throw new InvalidOperationException("O pacote baixado não confere com o SHA-256 do GitHub. Tente de novo.");
        }

        var raizNovo = Path.GetFullPath(novo) + Path.DirectorySeparatorChar;
        using (var z = ZipFile.OpenRead(zip))
        {
            foreach (var e in z.Entries)
            {
                var alvo = Path.GetFullPath(Path.Combine(novo, e.FullName));
                if (!alvo.StartsWith(raizNovo, StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("Pacote com caminho inválido.");
            }
            z.ExtractToDirectory(novo);
        }
        File.Delete(zip);

        var raiz = File.Exists(Path.Combine(novo, "versao.json")) ? novo
            : Directory.GetDirectories(novo).FirstOrDefault(d => File.Exists(Path.Combine(d, "versao.json")));
        if (raiz == null || !File.Exists(Path.Combine(raiz, "Matiz.dll")) || !File.Exists(Path.Combine(raiz, "ui", "index.html")))
            throw new InvalidOperationException("O pacote baixado está incompleto.");
        var vPacote = JsonNode.Parse(File.ReadAllText(Path.Combine(raiz, "versao.json")))?["versao"]?.GetValue<string>() ?? "";
        if (MaisNova(vPacote, versao) || MaisNova(versao, vPacote))
            throw new InvalidOperationException($"O pacote diz {vPacote}, mas a release é {versao}.");
        return (raiz, versao);
    }

    public static string Marca(string versao) => Path.Combine(Pasta, $"ok-{versao}");

    /// <summary>Lança o script que troca os arquivos depois que este processo fechar.</summary>
    public static void EntregarTroca(string pastaNova, string versao)
    {
        var script = Path.Combine(Pasta, "atualizar.ps1");
        File.Copy(Path.Combine(Base, "ferramentas", "atualizar.ps1"), script, true);
        var marca = Marca(versao);
        if (File.Exists(marca)) File.Delete(marca);
        var psi = new ProcessStartInfo("powershell.exe")
        {
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden,
        };
        foreach (var a in new[]
                 {
                     "-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", script,
                     "-Processo", Environment.ProcessId.ToString(),
                     "-Instalado", Base,
                     "-Novo", pastaNova,
                     "-Anterior", Path.Combine(Pasta, "anterior"),
                     "-Marca", marca,
                     "-Versao", versao,
                 })
            psi.ArgumentList.Add(a);
        Process.Start(psi);
    }
}
