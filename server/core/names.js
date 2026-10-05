// El nombre que la persona le pone a algo de una biblioteca (una imagen, un video, una
// presentación), tal como se verá en ella y en el orden del culto: sin espacios de más y con un largo razonable.
export const cleanName = (name, max = 80) => String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
