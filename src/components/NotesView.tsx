import { useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { confirm, notify } from '../lib/confirm';
import { useDb, type Note } from '../lib/db';
import { useIsDesktop } from '../lib/layout';
import { canSaveNote, noteCounts, noteDateLabel, noteName, visibleNotes, type NoteFilter } from '../lib/notes';
import { useThemeColors } from '../lib/theme';
import BackButton from './BackButton';
import { Empty } from './common';
import ScreenTitle from './ScreenTitle';
import TrashButton from './TrashButton';

const FILTERS: { id: NoteFilter; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'fijadas', label: 'Fijadas' },
  { id: 'pregunta', label: 'Pregunta del día' },
];

const INPUT = 'rounded-xl border border-ink-700 bg-ink-950 px-3 py-2.5 text-[15px] text-ink-100';

/** Anotaciones: notas sueltas y las respuestas a la Pregunta del día de Hoy. */
export default function NotesView() {
  const c = useThemeColors();
  const notes = useDb((s) => s.notes);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<NoteFilter>('todas');
  const [editing, setEditing] = useState<Note | 'new' | null>(null);

  const counts = useMemo(() => noteCounts(notes), [notes]);
  const list = useMemo(() => visibleNotes(notes, filter, query), [notes, filter, query]);
  const now = new Date();

  const emptyText = () => {
    if (notes.length === 0) return 'Todavía no tenés anotaciones. Tocá "+ Nueva" para escribir la primera: una lista, una idea, lo que quieras.';
    if (query.trim()) return `No hay notas con "${query.trim()}".`;
    if (filter === 'fijadas') return 'No tenés notas fijadas. Abrí una nota y prendé "📌 Fijar arriba".';
    if (filter === 'pregunta') return 'Todavía no respondiste ninguna Pregunta del día. La encontrás en Hoy.';
    return 'No hay notas para mostrar.';
  };

  return (
    <SafeAreaView className="flex-1 bg-ink-950" edges={['top']}>
      <ScrollView className="flex-1 px-4" contentContainerClassName="w-full max-w-3xl self-center gap-4 pb-10 pt-4" keyboardShouldPersistTaps="handled">
        <View className="flex-row flex-wrap items-center justify-between gap-3">
          <View className="flex-row items-center gap-2">
            <BackButton />
            <ScreenTitle categoryId="notas" subId="todas" />
          </View>
          <Pressable onPress={() => setEditing('new')} accessibilityRole="button" accessibilityLabel="Nueva nota" className="h-11 justify-center rounded-xl bg-shu-500 px-4 active:opacity-80">
            <Text className="text-[15px] font-bold text-washi">+ Nueva</Text>
          </Pressable>
        </View>

        <View className="h-11 flex-row items-center gap-2 rounded-xl border border-ink-700 bg-ink-900 pl-3">
          <Text className="text-sm opacity-60">🔍</Text>
          <TextInput
            className="h-11 flex-1 text-[15px] text-ink-100"
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar en tus notas"
            placeholderTextColor={c['ink-500']}
            accessibilityLabel="Buscar en tus notas"
            returnKeyType="search"
            autoCorrect={false}
          />
          {!!query && (
            <Pressable onPress={() => setQuery('')} className="h-11 w-11 items-center justify-center" accessibilityRole="button" accessibilityLabel="Borrar la búsqueda">
              <Text className="text-ink-400">✕</Text>
            </Pressable>
          )}
        </View>

        <View className="flex-row flex-wrap gap-2">
          {FILTERS.map((f) => {
            const on = filter === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => setFilter(f.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                className={`h-11 justify-center rounded-full px-3.5 ${on ? 'bg-shu-500' : 'border border-ink-700 bg-ink-800'}`}>
                <Text className={`text-sm ${on ? 'font-semibold text-washi' : 'text-ink-300'}`}>
                  {f.label} · {counts[f.id]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {list.length === 0 ? (
          <Empty>{emptyText()}</Empty>
        ) : (
          <View className="gap-2.5">
            {list.map((n) => (
              <NoteCard key={n.id} note={n} now={now} onOpen={() => setEditing(n)} />
            ))}
          </View>
        )}
      </ScrollView>

      {editing && <NoteEditor note={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </SafeAreaView>
  );
}

/** Tarjeta de una nota: tocarla la abre; 🗑️ la borra (pregunta antes). */
function NoteCard({ note, now, onOpen }: { note: Note; now: Date; onOpen: () => void }) {
  const pinned = !!note.pinned;
  const title = note.title.trim();
  const body = note.body.trim();
  const name = noteName(note);
  return (
    <View className={`rounded-2xl border pl-4 pr-1.5 pt-3.5 ${pinned ? 'border-shu-500/40 bg-shu-500/10' : 'border-ink-800 bg-ink-900'}`}>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Abrir la nota ${name}`} className="gap-1.5 pr-2.5 active:opacity-70">
        <View className="flex-row items-start justify-between gap-2">
          <View className="min-w-0 flex-1">
            {note.kind === 'pregunta' && <Text className="mb-1 text-[11px] font-bold tracking-wider text-shu-300">PREGUNTA DEL DÍA</Text>}
            {!!title && <Text className="text-base font-bold leading-5 text-ink-100">{title}</Text>}
          </View>
          {pinned && (
            <Text className="mt-0.5 text-sm" accessibilityLabel="Fijada">
              📌
            </Text>
          )}
        </View>
        {!!body && (
          <Text numberOfLines={3} className="text-sm leading-5 text-ink-400">
            {body}
          </Text>
        )}
      </Pressable>
      <View className="flex-row items-center justify-between">
        <Pressable onPress={onOpen} className="h-11 flex-1 justify-center" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text className="text-xs text-ink-500">{noteDateLabel(note.updatedAt, now)}</Text>
        </Pressable>
        <TrashButton what={`la nota "${name}"`} onDelete={() => useDb.getState().deleteNote(note.id)} />
      </View>
    </View>
  );
}

/** Interruptor visual (prendido = color de la app). */
function TogglePill({ on }: { on: boolean }) {
  return (
    <View className={`h-7 w-12 justify-center rounded-full px-0.5 ${on ? 'items-end bg-shu-500' : 'items-start bg-ink-700'}`}>
      <View className="h-6 w-6 rounded-full bg-washi" />
    </View>
  );
}

/** Escribir o editar una nota. Las respuestas a la Pregunta del día muestran la pregunta fija arriba. */
function NoteEditor({ note, onClose }: { note?: Note; onClose: () => void }) {
  const c = useThemeColors();
  const isDesktop = useIsDesktop();
  // Respuesta a la Pregunta del día: la pregunta (el título) no se edita.
  const question = note?.kind === 'pregunta' ? note : undefined;
  const [title, setTitle] = useState(note?.title ?? '');
  const [body, setBody] = useState(note?.body ?? '');
  const [pinned, setPinned] = useState(!!note?.pinned);
  // Un doble toque en "Guardar" no tiene que crear la nota dos veces.
  const saved = useRef(false);

  const save = () => {
    if (saved.current) return;
    if (!canSaveNote(title, body)) {
      notify('Falta un dato', 'Escribí un título o un texto para guardar la nota.');
      return;
    }
    const clean = { title: title.trim(), body: body.trim(), pinned: pinned || undefined };
    // Sin cambios no se toca (así no sube arriba de todo por haberla abierto).
    const unchanged = note && clean.title === note.title.trim() && clean.body === note.body.trim() && !!clean.pinned === !!note.pinned;
    saved.current = true;
    if (!unchanged) useDb.getState().saveNote({ ...clean, id: note?.id, title: question ? question.title : clean.title });
    onClose();
  };

  // Cerrar (✕, tocar afuera o "atrás") sin guardar: si escribió algo, pregunta antes de perderlo.
  const dirty = title !== (note?.title ?? '') || body !== (note?.body ?? '') || pinned !== !!note?.pinned;
  const close = async () => {
    if (dirty && !(await confirm('¿Salir sin guardar?', 'Se pierde lo que cambiaste en esta nota.', 'Salir sin guardar'))) return;
    onClose();
  };

  const remove = async () => {
    if (!note) return;
    if (!(await confirm('¿Borrar esta nota?', 'No se puede deshacer.', 'Borrar'))) return;
    useDb.getState().deleteNote(note.id);
    onClose();
  };

  return (
    <Modal transparent visible animationType={isDesktop ? 'fade' : 'slide'} onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable className={`flex-1 bg-black/60 ${isDesktop ? 'items-center justify-center px-4' : 'justify-end'}`} onPress={close}>
          <Pressable
            className={`max-h-[88%] border border-ink-800 bg-ink-900 ${isDesktop ? 'w-full max-w-xl rounded-3xl' : 'rounded-t-3xl'}`}
            onPress={(e) => e.stopPropagation()}>
            <View className="flex-row items-center justify-between border-b border-ink-800 py-2 pl-5 pr-2">
              <Text className="text-lg font-bold text-ink-100">📝 {note ? 'Editar nota' : 'Nueva nota'}</Text>
              <Pressable onPress={close} className="h-11 w-11 items-center justify-center" accessibilityLabel="Cerrar">
                <Text className="text-ink-300">✕</Text>
              </Pressable>
            </View>

            <ScrollView className="px-5 py-4" contentContainerClassName="gap-3" keyboardShouldPersistTaps="handled">
              {question ? (
                <View>
                  <Text className="mb-1 text-[11px] font-bold tracking-wider text-shu-300">PREGUNTA DEL DÍA</Text>
                  <Text className="text-base font-bold text-ink-100">{question.title}</Text>
                </View>
              ) : (
                <View>
                  <Text className="mb-1 text-sm text-ink-400">Título</Text>
                  <TextInput
                    className={INPUT}
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Ej: Lista del súper"
                    placeholderTextColor={c['ink-500']}
                    autoFocus={!note}
                    accessibilityLabel="Título"
                  />
                </View>
              )}
              <View>
                <Text className="mb-1 text-sm text-ink-400">{question ? 'Tu respuesta' : 'Texto'}</Text>
                <TextInput
                  className={`${INPUT} min-h-[140px]`}
                  value={body}
                  onChangeText={setBody}
                  placeholder="Escribí acá…"
                  placeholderTextColor={c['ink-500']}
                  multiline
                  textAlignVertical="top"
                  accessibilityLabel={question ? 'Tu respuesta' : 'Texto'}
                />
              </View>
              <Pressable
                onPress={() => setPinned(!pinned)}
                accessibilityRole="switch"
                accessibilityState={{ checked: pinned }}
                accessibilityLabel="Fijar arriba"
                className="min-h-[52px] flex-row items-center gap-3 rounded-xl border border-ink-800 bg-ink-950 px-3 py-2 active:opacity-80">
                <View className="flex-1">
                  <Text className="text-[15px] text-ink-100">📌 Fijar arriba</Text>
                  <Text className="text-xs text-ink-500">Queda primera en la lista.</Text>
                </View>
                <TogglePill on={pinned} />
              </Pressable>
            </ScrollView>

            <View className="flex-row gap-2 border-t border-ink-800 px-5 py-3 pb-8">
              {!!note && (
                <Pressable onPress={remove} accessibilityRole="button" className="h-12 items-center justify-center rounded-xl px-4">
                  <Text className="font-medium text-kurenai-400">Borrar</Text>
                </Pressable>
              )}
              <Pressable onPress={save} accessibilityRole="button" className="h-12 flex-1 items-center justify-center rounded-xl bg-shu-500 active:opacity-80">
                <Text className="text-base font-bold text-washi">Guardar</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
