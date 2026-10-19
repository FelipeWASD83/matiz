using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

namespace Matiz;

/// <summary>
/// Vibração digital da NVIDIA (a do Painel de Controle) pela nvapi64.dll que vem com o driver.
/// As funções não são exportadas pelo nome: saem do nvapi_QueryInterface por ID.
/// Nível 0 é o padrão (50% no painel); o máximo do driver (63 hoje) é 100%.
/// </summary>
internal sealed class Nvapi
{
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)] private delegate IntPtr QueryInterface(uint id);
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)] private delegate int FnInitialize();
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)] private delegate int FnEnumDisplay(uint indice, out IntPtr handle);
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)] private delegate int FnNomeDisplay(IntPtr handle, [Out] byte[] nome);
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)] private delegate int FnGetDvc(IntPtr handle, uint saida, ref DvcInfo info);
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)] private delegate int FnSetDvc(IntPtr handle, uint saida, uint nivel);

    [StructLayout(LayoutKind.Sequential)]
    private struct DvcInfo
    {
        public uint versao;
        public int atual;
        public int minimo;
        public int maximo;
    }

    private const uint ID_INITIALIZE = 0x0150E828;
    private const uint ID_ENUM_DISPLAY = 0x9ABDD40D;
    private const uint ID_NOME_DISPLAY = 0x22A78B05;
    private const uint ID_GET_DVC = 0x4085DE45;
    private const uint ID_SET_DVC = 0x172409B4;

    private FnEnumDisplay? _enum;
    private FnNomeDisplay? _nome;
    private FnGetDvc? _get;
    private FnSetDvc? _set;

    public bool Disponivel { get; private set; }
    public string Motivo { get; private set; } = "";

    public sealed record Tela(string Dispositivo, IntPtr Handle, int Atual, int Minimo, int Maximo);

    public Nvapi()
    {
        try
        {
            if (!NativeLibrary.TryLoad("nvapi64.dll", out var lib)) { Motivo = "Driver da NVIDIA não encontrado."; return; }
            var qi = Marshal.GetDelegateForFunctionPointer<QueryInterface>(NativeLibrary.GetExport(lib, "nvapi_QueryInterface"));
            T? Pegar<T>(uint id) where T : Delegate
            {
                var p = qi(id);
                return p == IntPtr.Zero ? null : Marshal.GetDelegateForFunctionPointer<T>(p);
            }
            var init = Pegar<FnInitialize>(ID_INITIALIZE);
            _enum = Pegar<FnEnumDisplay>(ID_ENUM_DISPLAY);
            _nome = Pegar<FnNomeDisplay>(ID_NOME_DISPLAY);
            _get = Pegar<FnGetDvc>(ID_GET_DVC);
            _set = Pegar<FnSetDvc>(ID_SET_DVC);
            if (init == null || _enum == null || _nome == null || _get == null || _set == null)
            {
                Motivo = "Este driver não expõe a vibração digital.";
                return;
            }
            int r = init();
            if (r != 0) { Motivo = $"A NVAPI não iniciou (código {r})."; return; }
            Disponivel = Telas().Count > 0;
            if (!Disponivel) Motivo = "Nenhuma tela ligada na placa da NVIDIA.";
        }
        catch (Exception e)
        {
            Motivo = "Erro ao carregar a NVAPI: " + e.Message;
            Disponivel = false;
        }
    }

    public List<Tela> Telas()
    {
        var lista = new List<Tela>();
        if (_enum == null || _nome == null || _get == null) return lista;
        for (uint i = 0; i < 16; i++)
        {
            if (_enum(i, out var h) != 0) break;
            var buf = new byte[64];
            if (_nome(h, buf) != 0) continue;
            var nome = Encoding.ASCII.GetString(buf).TrimEnd('\0');
            var info = new DvcInfo { versao = (uint)Marshal.SizeOf<DvcInfo>() | (1u << 16) };
            if (_get(h, 0, ref info) != 0) continue;
            lista.Add(new Tela(nome, h, info.atual, info.minimo, info.maximo));
        }
        return lista;
    }

    public bool Definir(IntPtr handle, int nivel) => _set != null && _set(handle, 0, (uint)Math.Max(0, nivel)) == 0;
}
