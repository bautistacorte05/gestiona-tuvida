import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/** Abre la galería, deja elegir una foto y devuelve un data URI JPEG liviano (o undefined si se canceló). */
export async function pickAndResizeImage(maxSize = 700): Promise<string | undefined> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return undefined;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.9,
  });
  if (result.canceled || !result.assets[0]) return undefined;

  const asset = result.assets[0];
  const scale = Math.min(1, maxSize / Math.max(asset.width, asset.height));
  const manipulated = await ImageManipulator.manipulateAsync(
    asset.uri,
    scale < 1 ? [{ resize: { width: Math.round(asset.width * scale) } }] : [],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );
  return `data:image/jpeg;base64,${manipulated.base64}`;
}
