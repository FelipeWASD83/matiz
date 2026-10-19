using System;
using System.Drawing;
using System.IO;
using System.Windows.Forms;

namespace Matiz;

/// <summary>Ícone perto do relógio: abre a janela, liga e desliga o filtro, fecha o app.</summary>
internal sealed class Bandeja : IDisposable
{
    private readonly NotifyIcon _icone;
    private readonly ToolStripMenuItem _ligado;

    public Bandeja(Nucleo nucleo)
    {
        var arq = Path.Combine(Atualizador.Base, "icone.ico");
        var menu = new ContextMenuStrip();
        var abrir = new ToolStripMenuItem("Abrir o Matiz") { Font = new Font(SystemFonts.MenuFont ?? Control.DefaultFont, FontStyle.Bold) };
        abrir.Click += (_, _) => nucleo.Abrir();
        _ligado = new ToolStripMenuItem("Filtro ligado") { CheckOnClick = false };
        _ligado.Click += (_, _) => nucleo.DefinirLigado(!nucleo.Config.Ligado);
        var sair = new ToolStripMenuItem("Sair (devolve as cores originais)");
        sair.Click += (_, _) => nucleo.Sair();
        menu.Items.AddRange(new ToolStripItem[] { abrir, _ligado, new ToolStripSeparator(), sair });

        _icone = new NotifyIcon
        {
            Icon = File.Exists(arq) ? new Icon(arq, 32, 32) : SystemIcons.Application,
            ContextMenuStrip = menu,
            Visible = true,
            Text = "Matiz",
        };
        _icone.MouseClick += (_, e) => { if (e.Button == MouseButtons.Left) nucleo.Abrir(); };
    }

    public void Atualizar(bool ligado, string situacao)
    {
        _ligado.Checked = ligado;
        _icone.Text = situacao switch
        {
            "ativo" => "Matiz: filtro ligado",
            "pausado" => "Matiz: pausado enquanto a janela está na frente",
            _ => "Matiz: filtro desligado",
        };
    }

    public void Avisar(string texto) => _icone.ShowBalloonTip(6000, "Matiz", texto, ToolTipIcon.Info);

    public void Dispose()
    {
        _icone.Visible = false;
        _icone.Dispose();
    }
}
