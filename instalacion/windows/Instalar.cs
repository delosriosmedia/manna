// Instalar-Manna-Windows.exe: el único archivo que hay que descargar para instalar Manna en Windows, con el icono de
// Manna y su engranaje. Lleva dentro el instalador (instalar.ps1, el mismo que usa el .bat para actualizar), lo deja
// en una carpeta temporal y lo ejecuta con PowerShell en esta misma ventana; al terminar, la borra.
//
// Se compila con el compilador de C# que trae Windows (.NET Framework 4), sin nada de terceros, en GitHub
// (.github/workflows/instaladores.yml):
//   csc /target:exe /win32icon:instalacion\icono\instalar.ico /resource:instalacion\windows\instalar.ps1,instalar.ps1
//       /out:Instalar-Manna-Windows.exe instalacion\windows\Instalar.cs
using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;

static class Instalar
{
    static int Main()
    {
        Console.Title = "Instalar Manna";
        string carpeta = Path.Combine(Path.GetTempPath(), "manna-instalador-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(carpeta);
        string guion = Path.Combine(carpeta, "instalar.ps1");
        Assembly yo = Assembly.GetExecutingAssembly();
        using (Stream dentro = yo.GetManifestResourceStream("instalar.ps1"))
        using (FileStream fuera = File.Create(guion))
        {
            dentro.CopyTo(fuera);
        }
        ProcessStartInfo inicio = new ProcessStartInfo("powershell.exe", "-NoProfile -ExecutionPolicy Bypass -File \"" + guion + "\"");
        inicio.UseShellExecute = false;
        // El instalador sabe así qué se abrió y desde dónde (ver MANNA_INSTALADOR en instalar.ps1).
        inicio.EnvironmentVariables["MANNA_INSTALADOR"] = yo.Location;
        // Las rutas de módulos de otro PowerShell (el 7, si lo abre él) confunden al 5.1 del sistema: se usan las suyas.
        inicio.EnvironmentVariables.Remove("PSModulePath");
        int codigo = 1;
        try
        {
            using (Process proceso = Process.Start(inicio))
            {
                proceso.WaitForExit();
                codigo = proceso.ExitCode;
            }
        }
        catch (Exception error)
        {
            Console.WriteLine();
            Console.WriteLine("  No se pudo abrir PowerShell: " + error.Message);
            Console.WriteLine("  Pulsa Intro para cerrar.");
            Console.ReadLine();
        }
        try { Directory.Delete(carpeta, true); } catch (IOException) { } catch (UnauthorizedAccessException) { }
        return codigo;
    }
}
