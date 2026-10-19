using System;
using System.Threading;
using System.Windows;

namespace Matiz;

public static class Programa
{
    private static Nucleo? _nucleo;

    [STAThread]
    public static void Main(string[] args)
    {
        if (Array.IndexOf(args, "--janela") >= 0)
        {
            Environment.Exit(Janela.Rodar());
            return;
        }
        if (Array.IndexOf(args, "--autoteste") >= 0)
        {
            Environment.Exit(Autoteste.Rodar());
            return;
        }

        bool soBandeja = Array.IndexOf(args, "--bandeja") >= 0;
        bool sair = Array.IndexOf(args, "--sair") >= 0;
        bool falhou = Array.IndexOf(args, "--atualizacao-falhou") >= 0;
        int i = Array.IndexOf(args, "--pos-atualizacao");
        string? marca = i >= 0 && i + 1 < args.Length ? args[i + 1] : null;

        using var instancia = new Mutex(true, @"Local\Matiz.Instancia", out bool primeira);
        if (!primeira)
        {
            // já tem um Matiz rodando: pede para ele abrir a janela (ou fechar, com --sair)
            var nome = sair ? @"Local\Matiz.Sair" : @"Local\Matiz.Abrir";
            try { using var ev = EventWaitHandle.OpenExisting(nome); ev.Set(); } catch { }
            return;
        }
        if (sair) return;

        var app = new Application { ShutdownMode = ShutdownMode.OnExplicitShutdown };
        app.DispatcherUnhandledException += (_, e) =>
        {
            Log.Escrever("erro: " + e.Exception);
            e.Handled = true;
        };
        AppDomain.CurrentDomain.UnhandledException += (_, e) =>
        {
            Log.Escrever("erro fatal: " + e.ExceptionObject);
            _nucleo?.Emergencia();
        };
        app.SessionEnding += (_, _) => _nucleo?.Emergencia();
        app.Startup += (_, _) => _nucleo = new Nucleo(app, soBandeja, marca, falhou);
        app.Run();
    }
}
