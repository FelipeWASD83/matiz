using System;
using System.IO;
using System.Text.Json.Nodes;
using System.Threading;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;

namespace Matiz;

/// <summary>
/// A janela de ajustes, no processo "--janela": uma casca com o WebView2 do Edge mostrando ui\.
/// Tudo o que a interface manda vai pelo canal para o processo da bandeja, e o que volta vai para a página.
/// Fechou a janela, o processo termina e a memória dele volta inteira para o Windows.
/// </summary>
internal sealed class Janela : Window
{
    private readonly Canal.Cliente _canal;
    private readonly WebView2 _web;

    public static int Rodar()
    {
        var canal = Canal.Cliente.Conectar(5000);
        if (canal == null) return 1;
        var app = new Application { ShutdownMode = ShutdownMode.OnMainWindowClose };
        app.DispatcherUnhandledException += (_, e) =>
        {
            Log.Escrever("erro na janela: " + e.Exception);
            e.Handled = true;
        };
        var janela = new Janela(canal);
        app.Run(janela);
        canal.Dispose();
        return 0;
    }

    private Janela(Canal.Cliente canal)
    {
        _canal = canal;
        Title = "Matiz";
        // abre no meio da tela principal (o ultrawide), sem passar da área útil dela
        var area = SystemParameters.WorkArea;
        Width = Math.Min(1440, area.Width * 0.92);
        Height = Math.Min(900, area.Height * 0.92);
        MinWidth = Math.Min(960, area.Width);
        MinHeight = Math.Min(640, area.Height);
        WindowStartupLocation = WindowStartupLocation.Manual;
        Left = area.Left + (area.Width - Width) / 2;
        Top = area.Top + (area.Height - Height) / 2;
        Background = new SolidColorBrush(Color.FromRgb(0x1b, 0x1b, 0x1d));
        var icone = Path.Combine(Atualizador.Base, "icone.ico");
        if (File.Exists(icone)) Icon = BitmapFrame.Create(new Uri(icone));

        _web = new WebView2 { DefaultBackgroundColor = System.Drawing.Color.FromArgb(0x1b, 0x1b, 0x1d) };
        Content = _web;
        SourceInitialized += (_, _) => BarraEscura();
        Loaded += async (_, _) => await Iniciar();
        Activated += (_, _) => _canal.Enviar(new JsonObject { ["tipo"] = "janela", ["ativa"] = true });
        Deactivated += (_, _) => _canal.Enviar(new JsonObject { ["tipo"] = "janela", ["ativa"] = false });
        Closed += (_, _) => _web.Dispose();

        _canal.Recebeu += Recebeu;
        _canal.Caiu += () => Close();
        _canal.Ouvir(Dispatcher);
        EscutarMostrar();
    }

    private void Recebeu(string json)
    {
        if (json.Contains("\"tipo\":\"fechar\""))
        {
            Close();
            return;
        }
        _web.CoreWebView2?.PostWebMessageAsJson(json);
    }

    /// <summary>Clique na bandeja com a janela já aberta: a bandeja dispara o evento e a janela vem para a frente.</summary>
    private void EscutarMostrar()
    {
        var ev = new EventWaitHandle(false, EventResetMode.AutoReset, Canal.EVENTO_MOSTRAR);
        new Thread(() =>
        {
            while (true)
            {
                ev.WaitOne();
                Dispatcher.BeginInvoke(() =>
                {
                    if (WindowState == WindowState.Minimized) WindowState = WindowState.Normal;
                    Activate();
                });
            }
        }) { IsBackground = true, Name = "mostrar janela" }.Start();
    }

    private void BarraEscura()
    {
        var h = new WindowInteropHelper(this).Handle;
        int sim = 1;
        Nativo.DwmSetWindowAttribute(h, Nativo.DWMWA_USE_IMMERSIVE_DARK_MODE, ref sim, sizeof(int));
        int cor = 0x1d1b1b; // COLORREF é 0x00BBGGRR
        Nativo.DwmSetWindowAttribute(h, Nativo.DWMWA_CAPTION_COLOR, ref cor, sizeof(int));
        Nativo.DwmSetWindowAttribute(h, Nativo.DWMWA_BORDER_COLOR, ref cor, sizeof(int));
    }

    private async System.Threading.Tasks.Task Iniciar()
    {
        try
        {
            var env = await CoreWebView2Environment.CreateAsync(null, Path.Combine(Config.Pasta, "webview"));
            await _web.EnsureCoreWebView2Async(env);
            var w = _web.CoreWebView2;
            w.Settings.AreDevToolsEnabled = Atualizador.Desenvolvimento();
            w.Settings.AreDefaultContextMenusEnabled = false;
            w.Settings.IsZoomControlEnabled = false;
            w.Settings.IsStatusBarEnabled = false;
            w.Settings.AreBrowserAcceleratorKeysEnabled = Atualizador.Desenvolvimento();
            w.SetVirtualHostNameToFolderMapping("matiz.local", Path.Combine(Atualizador.Base, "ui"), CoreWebView2HostResourceAccessKind.Allow);
            w.WebMessageReceived += (_, e) => _canal.Enviar(e.WebMessageAsJson);
            w.NewWindowRequested += (_, e) => e.Handled = true;
            w.Navigate("https://matiz.local/index.html");
        }
        catch (Exception e)
        {
            Log.Escrever("WebView2 não abriu: " + e);
            MessageBox.Show(this,
                "A interface não abriu porque o WebView2 do Edge não respondeu.\n\n" + e.Message +
                "\n\nO filtro continua funcionando pela bandeja.",
                "Matiz", MessageBoxButton.OK, MessageBoxImage.Warning);
            Close();
        }
    }
}
