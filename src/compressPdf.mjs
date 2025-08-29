/*
 *
 * Helper: `compressPdfAggressive`.
 *
 */
import { exec } from "child_process";

// 1- install Ghostscript https://ghostscript.com/releases/gsdnld.html
// 2- add C:\Program Files\gs\gs10.05.1\bin to your PATH environment variable

const compressPdfAggressive = (input, output) => {
  return new Promise((resolve) => {
    const cmd = `gswin64c -sDEVICE=pdfwrite -dCompatibilityLevel=1.3 \
      -dPDFSETTINGS=/screen -dEmbedAllFonts=false -dSubsetFonts=true -dCompressFonts=true \
      -dDetectDuplicateImages=true -dDownsampleColorImages=true \
      -dColorImageResolution=78 -dGrayImageResolution=78 -dMonoImageResolution=78 \
      -dAutoFilterColorImages=false -dColorImageFilter=/DCTEncode -dJPEGQ=70 \
      -dCompressPages=true \
      -dPreserveAnnots=false -dPreserveMarkedContent=false -dPreserveOverprintSettings=false \
      -dPreserveOPIComments=false -dPreserveEPSInfo=false \
      -dNOPAUSE -dQUIET -dBATCH -sOutputFile="${output}" "${input}"`;

    exec(cmd, (err) => {
      if (err) {
        resolve({ success: false, error: err });
      } else {
        resolve({ success: true, output });
      }
    });
  });
};

export default compressPdfAggressive;
