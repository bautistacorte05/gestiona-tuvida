import { View } from 'react-native';

/** En la PC (navegador) se usa el selector de hora del navegador. Vacío = sin hora. */
export default function TimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <View className="rounded-lg border border-ink-700 bg-ink-900 px-1">
      <input
        type="time"
        value={value}
        aria-label="Hora (opcional)"
        onChange={(e: any) => onChange(e.target.value)}
        style={{ background: 'transparent', border: 'none', color: 'rgb(var(--ink-100))', fontSize: 16, padding: '10px 8px', width: '100%', outline: 'none' }}
      />
    </View>
  );
}
