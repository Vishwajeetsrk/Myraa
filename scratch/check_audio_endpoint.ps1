$code = @'
using System.Runtime.InteropServices;

[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
    int f(); int g(); int h(); int j();
    int SetMasterVolumeLevel(float fLevelDB, System.Guid pguidEventContext);
    int SetMasterVolumeLevelScalar(float fLevel, System.Guid pguidEventContext);
    int GetMasterVolumeLevel(out float pfLevelDB);
    int GetMasterVolumeLevelScalar(out float pfLevel);
    int SetMute(bool bMute, System.Guid pguidEventContext);
    int GetMute(out bool pbMute);
}

[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice {
    int Activate(ref System.Guid id, int clsCtx, int activationParams, out IAudioEndpointVolume aev);
}

[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator {
    int f();
    int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
}

[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291433E")]
class MMDeviceEnumeratorComObject {}

public class AudioHelper {
    public static float GetVolume() {
        IMMDeviceEnumerator enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumeratorComObject());
        IMMDevice dev = null;
        enumerator.GetDefaultAudioEndpoint(0, 1, out dev);
        System.Guid IID_IAudioEndpointVolume = typeof(IAudioEndpointVolume).GUID;
        IAudioEndpointVolume epv = null;
        dev.Activate(ref IID_IAudioEndpointVolume, 23, 0, out epv);
        float volume = 0;
        epv.GetMasterVolumeLevelScalar(out volume);
        return volume;
    }

    public static bool GetMute() {
        IMMDeviceEnumerator enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumeratorComObject());
        IMMDevice dev = null;
        enumerator.GetDefaultAudioEndpoint(0, 1, out dev);
        System.Guid IID_IAudioEndpointVolume = typeof(IAudioEndpointVolume).GUID;
        IAudioEndpointVolume epv = null;
        dev.Activate(ref IID_IAudioEndpointVolume, 23, 0, out epv);
        bool mute = false;
        epv.GetMute(out mute);
        return mute;
    }

    public static void SetUnmuteAndVolume(float vol) {
        IMMDeviceEnumerator enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumeratorComObject());
        IMMDevice dev = null;
        enumerator.GetDefaultAudioEndpoint(0, 1, out dev);
        System.Guid IID_IAudioEndpointVolume = typeof(IAudioEndpointVolume).GUID;
        IAudioEndpointVolume epv = null;
        dev.Activate(ref IID_IAudioEndpointVolume, 23, 0, out epv);
        epv.SetMute(false, System.Guid.Empty);
        epv.SetMasterVolumeLevelScalar(vol, System.Guid.Empty);
    }
}
'@

Add-Type -TypeDefinition $code
$vol = [AudioHelper]::GetVolume()
$mute = [AudioHelper]::GetMute()
Write-Output "Current Volume: $([math]::Round($vol * 100))%"
Write-Output "Current Mute: $mute"

if ($mute -or $vol -lt 0.3) {
    Write-Output "Unmuting and boosting volume to 65%..."
    [AudioHelper]::SetUnmuteAndVolume(0.65)
    Write-Output "New Volume: $([math]::Round([AudioHelper]::GetVolume() * 100))%"
    Write-Output "New Mute: $([AudioHelper]::GetMute())"
}
