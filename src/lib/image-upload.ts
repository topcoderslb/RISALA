export async function uploadToImageBB(file: File): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_IMAGEBB_API_KEY;
  if (!apiKey) throw new Error('ImageBB API key not configured');

  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) throw new Error('فشل رفع الصورة');

  const data = await response.json();
  return data.data.url;
}

export async function uploadMultipleImages(files: File[]): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    const url = await uploadToImageBB(file);
    urls.push(url);
  }
  return urls;
}
