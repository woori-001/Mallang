// 패키징 후 Windows 실행 파일(.exe)에 아이콘과 버전 정보를 넣습니다. (Wine 없이 동작)
const fs = require('fs');
const path = require('path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;
  const ResEdit = await import('resedit');
  const { NtExecutable, NtExecutableResource, Resource, Data } = ResEdit.default || ResEdit;
  const appInfo = context.packager.appInfo;
  const exePath = path.join(context.appOutDir, appInfo.productFilename + '.exe');
  const iconPath = path.join(__dirname, '..', 'build', 'icon.ico');

  const exe = NtExecutable.from(fs.readFileSync(exePath));
  const res = NtExecutableResource.from(exe);

  const iconFile = Data.IconFile.from(fs.readFileSync(iconPath));
  Resource.IconGroupEntry.replaceIconsForResource(res.entries, 1, 1033, iconFile.icons.map((i) => i.data));

  const vi = Resource.VersionInfo.fromEntries(res.entries)[0] || Resource.VersionInfo.createEmpty();
  const [a, b, c] = appInfo.version.split('.').map(Number);
  vi.setFileVersion(a, b, c, 0, 1033);
  vi.setProductVersion(a, b, c, 0, 1033);
  vi.setStringValues({ lang: 1033, codepage: 1200 }, {
    FileDescription: appInfo.productName,
    ProductName: appInfo.productName,
    CompanyName: appInfo.productName,
    LegalCopyright: appInfo.copyright || '',
    OriginalFilename: appInfo.productFilename + '.exe',
    InternalName: appInfo.productFilename
  });
  vi.outputToResourceEntries(res.entries);

  res.outputResource(exe);
  fs.writeFileSync(exePath, Buffer.from(exe.generate()));
  console.log('  • 아이콘/버전 정보 적용:', path.basename(exePath));
};
