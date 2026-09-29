import { View } from 'react-native';

/** En la PC (navegador) usamos el selector de fecha nativo del navegador en vez del de iOS. */
export default function DateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <View className="rounded-lg border border-ink-700 bg-ink-900 px-1">
      <input
        type="date"
        value={value}
        onChange={(e: any) => onChange(e.target.value)}
        style={{ background: 'transparent', border: 'none', color: '#ede3d3', fontSize: 16, padding: '10px 8px', width: '100%', outline: 'none' }}
      />
    </View>
  );
}
