import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

export async function persistObservationImage(sourceUri: string) {
  const directory = new Directory(Paths.document, 'observation-images');
  directory.create({ idempotent: true, intermediates: true });

  const source = new File(sourceUri);
  const extension = /^\.[a-zA-Z0-9]{1,6}$/.test(source.extension) ? source.extension : '.jpg';
  const destination = new File(directory, `${randomUUID()}${extension.toLowerCase()}`);
  await source.copy(destination);
  return destination.uri;
}
