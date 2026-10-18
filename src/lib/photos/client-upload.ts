'use client';

export async function prepareCookingPhoto(file: File): Promise<Blob> {
  if (file.size > 20_000_000) throw new Error('Choose a photo under 20 MB.');
  const url=URL.createObjectURL(file);
  try {
    const image=new Image();
    image.src=url;
    try {await image.decode();} catch {
      throw new Error('Could not open this photo. Export it as JPEG or choose another image.');
    }
    const scale=Math.min(1,1200/Math.max(image.naturalWidth,image.naturalHeight));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
    canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    const context=canvas.getContext('2d');
    if(!context)throw new Error('Your browser could not prepare the photo.');
    context.drawImage(image,0,0,canvas.width,canvas.height);
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Could not prepare photo.')),'image/jpeg',0.82));
    if(blob.size>4_000_000)throw new Error('This photo is too large. Choose a smaller image.');
    return blob;
  } finally {URL.revokeObjectURL(url);}
}
