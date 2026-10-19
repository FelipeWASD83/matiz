using System;
using System.Runtime.InteropServices;

namespace Matiz;

internal static unsafe class Nativo
{
    // Matriz de cor 5x5 da API de Ampliação: linha = canal de entrada (R, G, B, A, 1), coluna = canal de saída.
    [StructLayout(LayoutKind.Sequential)]
    public struct MAGCOLOREFFECT
    {
        public fixed float transform[25];
    }

    [DllImport("Magnification.dll", SetLastError = true)]
    public static extern bool MagInitialize();

    [DllImport("Magnification.dll", SetLastError = true)]
    public static extern bool MagUninitialize();

    [DllImport("Magnification.dll", SetLastError = true)]
    public static extern bool MagSetFullscreenColorEffect(ref MAGCOLOREFFECT pEffect);

    [DllImport("Magnification.dll", SetLastError = true)]
    public static extern bool MagGetFullscreenColorEffect(out MAGCOLOREFFECT pEffect);

    // Rampa de gama: 256 valores de vermelho, depois 256 de verde, depois 256 de azul.
    [StructLayout(LayoutKind.Sequential)]
    public struct RAMP
    {
        public fixed ushort valores[768];
    }

    [DllImport("gdi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern IntPtr CreateDC(string? driver, string device, IntPtr output, IntPtr initData);

    [DllImport("gdi32.dll")]
    public static extern bool DeleteDC(IntPtr hdc);

    [DllImport("gdi32.dll", SetLastError = true)]
    public static extern bool SetDeviceGammaRamp(IntPtr hdc, ref RAMP ramp);

    [DllImport("gdi32.dll", SetLastError = true)]
    public static extern bool GetDeviceGammaRamp(IntPtr hdc, out RAMP ramp);

    public const int MOD_ALT = 0x1, MOD_CONTROL = 0x2, MOD_SHIFT = 0x4, MOD_WIN = 0x8, MOD_NOREPEAT = 0x4000;
    public const int WM_HOTKEY = 0x0312;

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool RegisterHotKey(IntPtr hWnd, int id, int modifiers, int vk);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool UnregisterHotKey(IntPtr hWnd, int id);

    [DllImport("user32.dll")]
    public static extern bool AllowSetForegroundWindow(int processId);

    [DllImport("dwmapi.dll")]
    public static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int value, int size);

    public const int DWMWA_USE_IMMERSIVE_DARK_MODE = 20, DWMWA_CAPTION_COLOR = 35, DWMWA_BORDER_COLOR = 34;
}
