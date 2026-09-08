const { execSync } = require('child_process');
const fs = require('fs');

const vbs = `
Set ws = CreateObject("WScript.Shell")
Set sc1 = ws.CreateShortcut("C:\\Users\\Vishwajeet\\OneDrive\\Desktop\\MYRAA AI OS.lnk")
Set sc2 = ws.CreateShortcut("C:\\Users\\Vishwajeet\\Desktop\\MYRAA AI OS.lnk")
WScript.Echo "OneDrive: " & sc1.TargetPath & " | " & sc1.WorkingDirectory
WScript.Echo "Standard: " & sc2.TargetPath & " | " & sc2.WorkingDirectory
`;
fs.writeFileSync('d:/Team of Vishwajeet/MYRAA/resources/app/dist/scratch/inspect_sc.vbs', vbs);
const out = execSync('cscript //nologo "d:\\Team of Vishwajeet\\MYRAA\\resources\\app\\dist\\scratch\\inspect_sc.vbs"', { encoding: 'utf8' });
console.log(out);
