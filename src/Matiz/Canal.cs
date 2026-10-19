using System;
using System.IO;
using System.IO.Pipes;
using System.Text;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Threading;

namespace Matiz;

/// <summary>
/// A janela roda num processo à parte ("Matiz.exe --janela"): o WPF e o WebView2 não devolvem a memória
/// depois de carregados, e assim, quando a janela fecha, o processo dela some e o da bandeja fica leve.
/// Os dois conversam por um pipe com uma mensagem JSON por linha (as mesmas que a interface manda).
/// </summary>
internal static class Canal
{
    public static string Nome => "Matiz.Interface." + Environment.UserName;
    public const string EVENTO_MOSTRAR = @"Local\Matiz.MostrarJanela";
    private static readonly UTF8Encoding Utf8 = new(false);

    /// <summary>Lado da bandeja: aceita uma janela por vez e entrega as linhas no dispatcher.</summary>
    public sealed class Servidor
    {
        private readonly Dispatcher _ui;
        private readonly Action<string> _aoReceber;
        private readonly Action<bool> _aoMudarConexao;
        private StreamWriter? _escrita;
        private readonly object _trava = new();

        public bool Conectado { get; private set; }

        public Servidor(Dispatcher ui, Action<string> aoReceber, Action<bool> aoMudarConexao)
        {
            _ui = ui;
            _aoReceber = aoReceber;
            _aoMudarConexao = aoMudarConexao;
            new Thread(Laco) { IsBackground = true, Name = "canal da janela" }.Start();
        }

        private void Laco()
        {
            while (true)
            {
                try
                {
                    using var pipe = new NamedPipeServerStream(Nome, PipeDirection.InOut, 1, PipeTransmissionMode.Byte, PipeOptions.Asynchronous);
                    pipe.WaitForConnection();
                    lock (_trava) _escrita = new StreamWriter(pipe, Utf8) { AutoFlush = true, NewLine = "\n" };
                    Conectado = true;
                    _ui.BeginInvoke(() => _aoMudarConexao(true));
                    using var leitura = new StreamReader(pipe, Utf8);
                    string? linha;
                    while ((linha = leitura.ReadLine()) != null)
                    {
                        var l = linha;
                        _ui.BeginInvoke(() => _aoReceber(l));
                    }
                }
                catch (Exception e) { Log.Escrever("canal: " + e.Message); Thread.Sleep(300); }
                finally
                {
                    lock (_trava) _escrita = null;
                    if (Conectado)
                    {
                        Conectado = false;
                        _ui.BeginInvoke(() => _aoMudarConexao(false));
                    }
                }
            }
        }

        public void Enviar(JsonObject m)
        {
            lock (_trava)
            {
                try { _escrita?.WriteLine(m.ToJsonString()); }
                catch (IOException) { }
            }
        }
    }

    /// <summary>Lado da janela: conecta na bandeja; se a conexão cair, avisa para a janela fechar.</summary>
    public sealed class Cliente : IDisposable
    {
        private readonly NamedPipeClientStream _pipe;
        private readonly StreamWriter _escrita;
        private readonly object _trava = new();

        public event Action<string>? Recebeu;
        public event Action? Caiu;

        private Cliente(NamedPipeClientStream pipe)
        {
            _pipe = pipe;
            _escrita = new StreamWriter(pipe, Utf8) { AutoFlush = true, NewLine = "\n" };
        }

        public static Cliente? Conectar(int milissegundos)
        {
            var pipe = new NamedPipeClientStream(".", Nome, PipeDirection.InOut, PipeOptions.Asynchronous);
            try { pipe.Connect(milissegundos); }
            catch (Exception e)
            {
                Log.Escrever("janela não achou a bandeja: " + e.Message);
                pipe.Dispose();
                return null;
            }
            return new Cliente(pipe);
        }

        public void Ouvir(Dispatcher ui)
        {
            Task.Run(() =>
            {
                try
                {
                    using var leitura = new StreamReader(_pipe, Utf8);
                    string? linha;
                    while ((linha = leitura.ReadLine()) != null)
                    {
                        var l = linha;
                        ui.BeginInvoke(() => Recebeu?.Invoke(l));
                    }
                }
                catch (Exception) { }
                ui.BeginInvoke(() => Caiu?.Invoke());
            });
        }

        public void Enviar(string json)
        {
            lock (_trava)
            {
                try { _escrita.WriteLine(json); }
                catch (IOException) { }
            }
        }

        public void Enviar(JsonObject m) => Enviar(m.ToJsonString());

        public void Dispose() => _pipe.Dispose();
    }
}
