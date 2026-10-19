using System;
using System.Collections.Generic;
using Microsoft.Win32;

namespace Matiz;

/// <summary>
/// Atalho global (funciona com o jogo na frente) numa janela só de mensagens.
/// É uma NativeWindow do WinForms, não uma HwndSource do WPF: a do WPF liga o motor de
/// renderização inteiro (uns 45 MB a mais) só para receber uma tecla.
/// </summary>
internal sealed class Teclas : IDisposable
{
    private const int ID = 0x4D5A;
    private readonly Receptor _janela;
    private bool _registrado;

    public event Action? Apertou;

    private sealed class Receptor : System.Windows.Forms.NativeWindow
    {
        public Action? AoApertar;

        public Receptor()
        {
            CreateHandle(new System.Windows.Forms.CreateParams { Caption = "MatizTeclas", Parent = new IntPtr(-3) });
        }

        protected override void WndProc(ref System.Windows.Forms.Message m)
        {
            if (m.Msg == Nativo.WM_HOTKEY && m.WParam.ToInt32() == ID) AoApertar?.Invoke();
            base.WndProc(ref m);
        }
    }

    public Teclas()
    {
        _janela = new Receptor { AoApertar = () => Apertou?.Invoke() };
    }

    /// <summary>Registra o atalho. Devolve false se outro programa já usa a combinação.</summary>
    public bool Registrar(Atalho a)
    {
        Soltar();
        if (a.Tecla == 0) return true;
        _registrado = Nativo.RegisterHotKey(_janela.Handle, ID, a.Mods | Nativo.MOD_NOREPEAT, a.Tecla);
        return _registrado;
    }

    private void Soltar()
    {
        if (_registrado) Nativo.UnregisterHotKey(_janela.Handle, ID);
        _registrado = false;
    }

    public static string Nome(Atalho a)
    {
        if (a.Tecla == 0) return "nenhum";
        var partes = new List<string>();
        if ((a.Mods & Nativo.MOD_CONTROL) != 0) partes.Add("Ctrl");
        if ((a.Mods & Nativo.MOD_ALT) != 0) partes.Add("Alt");
        if ((a.Mods & Nativo.MOD_SHIFT) != 0) partes.Add("Shift");
        if ((a.Mods & Nativo.MOD_WIN) != 0) partes.Add("Win");
        partes.Add(((System.Windows.Forms.Keys)a.Tecla).ToString());
        return string.Join(" + ", partes);
    }

    public void Dispose()
    {
        Soltar();
        _janela.DestroyHandle();
    }
}

/// <summary>Liga e desliga o "iniciar com o Windows" (só no usuário, sem admin).</summary>
internal static class Inicio
{
    private const string CHAVE = @"Software\Microsoft\Windows\CurrentVersion\Run";
    private const string NOME = "Matiz";

    public static void Definir(bool ligado)
    {
        try
        {
            using var k = Registry.CurrentUser.OpenSubKey(CHAVE, true);
            if (k == null) return;
            if (ligado) k.SetValue(NOME, $"\"{Environment.ProcessPath}\" --bandeja");
            else if (k.GetValue(NOME) != null) k.DeleteValue(NOME);
        }
        catch (Exception e) { Log.Escrever("iniciar com o Windows: " + e.Message); }
    }
}
