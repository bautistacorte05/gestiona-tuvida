import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';

import { formatDay, monthKey, today } from '../../lib/dates';
import { useDb, type Entry } from '../../lib/db';
import { useFindSub } from '../../lib/names';
import {
  bookKey,
  booksIn,
  daysToFinish,
  formatDuration,
  monthTotals,
  numOf,
  pagesByBook,
  pagesPerDay,
  readingPace,
  shortAuthor,
  stars,
  uniqueBooks,
  type BookState,
} from '../../lib/reading';
import { confirm } from '../../lib/confirm';
import { markDone } from '../../lib/sheets';
import { computeStreak } from '../../lib/streak';
import { useThemeColors } from '../../lib/theme';
import EntryForm from '../EntryForm';
import TrashButton from '../TrashButton';
import { Chip, Hero, PrimaryButton, Section, SheetScreen, SmallButton, StatTile } from './kit';

// Borrar un libro no borra las páginas ya anotadas de ese libro (siguen contando en el mes).
const deleteBook = (b: Entry) => useDb.getState().deleteEntry(b.id);
const BOOK_DELETE_DETAIL = 'Las páginas que ya anotaste de ese libro quedan guardadas. No se puede deshacer.';

/**
 * Hoja de Lectura: el libro que estás leyendo (anotar páginas con un toque), cuánto leíste,
 * los libros para leer y los terminados. Usa los registros de siempre: Libros (lectura/libros)
 * y Sesiones (lectura/sesiones, unidas al libro por el título).
 */

const QUICK_PAGES = [10, 25, 50];
const PAGE_SIZE = 6;
const COVER_MIN_W = 104;
const COVER_GAP = 10;
const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, "Times New Roman", serif' });
const intFmt = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });

const titleOf = (b: Entry) => String(b.values.titulo ?? '').trim() || 'Sin título';
const authorOf = (b: Entry) => String(b.values.autor ?? '').trim();
const plural = (n: number, one: string, many: string) => `${intFmt.format(n)} ${n === 1 ? one : many}`;

type Editing = { subId: 'libros' | 'sesiones'; entry?: Entry };

/** Mensaje corto que se va solo ("Anotado ✓"). */
function useFlash(ms = 2200) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const show = useCallback(
    (m: string) => {
      setMsg(m);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setMsg(null), ms);
    },
    [ms],
  );
  return [msg, show] as const;
}

export default function ReadingSheet() {
  const entries = useDb((s) => s.entries);
  const checks = useDb((s) => s.checks);
  const saveEntry = useDb((s) => s.saveEntry);
  const librosSub = useFindSub('lectura', 'libros');
  const sesionesSub = useFindSub('lectura', 'sesiones');
  const now = today();

  const [editing, setEditing] = useState<Editing | null>(null);
  const [currentId, setCurrentId] = useState<string>();
  const [flash, showFlash] = useFlash();

  const books = useMemo(() => entries.filter((e) => e.categoryId === 'lectura' && e.subId === 'libros'), [entries]);
  const sessions = useMemo(() => entries.filter((e) => e.categoryId === 'lectura' && e.subId === 'sesiones'), [entries]);
  // Un mismo libro cargado dos veces se muestra una sola vez; las copias se ofrecen borrar.
  const { unique: reading, copies: readingCopies } = useMemo(() => uniqueBooks(booksIn(books, 'Leyendo')), [books]);
  const toRead = useMemo(() => booksIn(books, 'Pendiente'), [books]);
  const finished = useMemo(() => booksIn(books, 'Terminado'), [books]);
  const abandoned = useMemo(() => booksIn(books, 'Abandonado'), [books]);
  const pagesRead = useMemo(() => pagesByBook(sessions), [sessions]);
  const perDay = useMemo(() => pagesPerDay(sessions, now), [sessions, now]);
  const pace = useMemo(() => readingPace(sessions, now), [sessions, now]);
  const month = useMemo(() => monthTotals(sessions, monthKey(now)), [sessions, now]);
  const streak = useMemo(() => computeStreak(checks, 'lectura'), [checks]);
  const history = useMemo(() => [...sessions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt), [sessions]);

  const current = reading.find((b) => b.id === currentId) ?? reading[0];
  const currentCopies = current ? readingCopies.filter((b) => bookKey(b.values.titulo) === bookKey(current.values.titulo)) : [];

  /** Deja una sola copia del libro (la que se ve). Las páginas anotadas siguen unidas por el nombre. */
  const removeCopies = async () => {
    if (!current || !currentCopies.length) return;
    const n = currentCopies.length;
    const ok = await confirm(
      `¿Dejar un solo "${titleOf(current)}"?`,
      `Se ${n === 1 ? 'borra la copia repetida' : `borran las ${n} copias repetidas`}. Las páginas que anotaste no se pierden.`,
      'Dejar uno solo',
    );
    if (ok) for (const b of currentCopies) deleteBook(b);
  };

  const setState = (book: Entry, estado: BookState) =>
    saveEntry({ id: book.id, categoryId: book.categoryId, subId: book.subId, date: book.date, values: { ...book.values, estado } });

  const start = (book: Entry) => {
    setState(book, 'Leyendo');
    setCurrentId(book.id);
  };

  const addPages = (n: number) => {
    if (!current || !(n > 0)) return;
    const date = today();
    saveEntry({ categoryId: 'lectura', subId: 'sesiones', date, values: { libro: titleOf(current), paginas: n } });
    markDone(date, 'lectura');
    showFlash(`Anotado ✓ · ${plural(n, 'página', 'páginas')}`);
  };

  /** Lo pasa a Terminado y abre su ficha por si querés ponerle puntaje. */
  const finish = (book: Entry) => {
    setState(book, 'Terminado');
    setEditing({ subId: 'libros', entry: { ...book, values: { ...book.values, estado: 'Terminado' } } });
  };

  const editBook = (book?: Entry) => setEditing({ subId: 'libros', entry: book });
  const target = editing?.subId === 'sesiones' ? sesionesSub : librosSub;

  return (
    <SheetScreen
      categoryId="lectura"
      overlay={
        editing && target ? (
          <EntryForm
            key={editing.entry?.id ?? 'new'}
            category={target.category}
            sub={target.sub}
            entry={editing.entry}
            defaultDate={now}
            onClose={() => setEditing(null)}
          />
        ) : null
      }>
      {current ? (
        <ReadingNow
          book={current}
          others={reading}
          copies={currentCopies.length}
          onRemoveCopies={removeCopies}
          read={pagesRead.get(bookKey(current.values.titulo)) ?? 0}
          pace={pace}
          flash={flash}
          onPick={setCurrentId}
          onAdd={addPages}
          onFinish={() => finish(current)}
          onEdit={() => editBook(current)}
        />
      ) : (
        <StartReading toRead={toRead} onStart={start} onAdd={() => editBook()} />
      )}

      <View className="flex-row gap-2.5">
        <StatTile label="Páginas" value={intFmt.format(month.pages)} hint="este mes" style={{ flex: 1 }} />
        <StatTile label="Tiempo" value={formatDuration(month.minutes)} hint="este mes" style={{ flex: 1 }} />
        <StatTile label="Racha" value={plural(streak, 'día', 'días')} hint="seguidos" style={{ flex: 1 }} />
      </View>

      <Section title="Páginas por día">
        <PagesChart days={perDay} now={now} />
      </Section>

      <ToReadSection books={toRead} onOpen={editBook} onStart={start} onAdd={() => editBook()} />

      {finished.length > 0 && (
        <Section title={`Terminados · ${finished.length}`}>
          <PagedList items={finished} render={(b, first) => <FinishedRow key={b.id} book={b} first={first} onPress={() => editBook(b)} />} />
        </Section>
      )}

      {abandoned.length > 0 && (
        <Collapsible label={`Abandonados · ${abandoned.length}`}>
          <PagedList items={abandoned} render={(b, first) => <FinishedRow key={b.id} book={b} first={first} onPress={() => editBook(b)} />} />
        </Collapsible>
      )}

      <Section
        title="Historial"
        subtitle="Las páginas que fuiste anotando. Tocá una para corregirla o sumarle el tiempo."
        right={<SmallButton label="+ Agregar" onPress={() => setEditing({ subId: 'sesiones' })} accessibilityLabel="Agregar lectura con todos los datos" />}>
        {history.length === 0 ? (
          <Text className="text-sm text-ink-400">Todavía no anotaste páginas.</Text>
        ) : (
          <PagedList
            items={history}
            render={(s, first) => <SessionRow key={s.id} session={s} now={now} first={first} onPress={() => setEditing({ subId: 'sesiones', entry: s })} />}
          />
        )}
      </Section>
    </SheetScreen>
  );
}

/** Tarjeta de arriba con el libro que estás leyendo y los botones para anotar páginas. */
function ReadingNow({
  book,
  others,
  copies,
  onRemoveCopies,
  read,
  pace,
  flash,
  onPick,
  onAdd,
  onFinish,
  onEdit,
}: {
  book: Entry;
  others: Entry[];
  /** Cuántas veces más está cargado este mismo libro (0 = ninguna). */
  copies: number;
  onRemoveCopies: () => void;
  read: number;
  pace: number | undefined;
  flash: string | null;
  onPick: (id: string) => void;
  onAdd: (pages: number) => void;
  onFinish: () => void;
  onEdit: () => void;
}) {
  const c = useThemeColors();
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherText, setOtherText] = useState('');
  const title = titleOf(book);
  const author = authorOf(book);
  const total = numOf(book.values.paginasTotales);
  const daysLeft = total > 0 ? daysToFinish(total, read, pace) : undefined;
  const otherPages = Math.round(Number(otherText.replace(',', '.')));
  const otherValid = Number.isFinite(otherPages) && otherPages > 0;

  const submitOther = () => {
    if (!otherValid) return;
    onAdd(otherPages);
    setOtherText('');
    setOtherOpen(false);
  };

  return (
    <Hero title="Leyendo ahora" right={<SmallButton label="Lo terminé" onPress={onFinish} accessibilityLabel={`Marcar ${title} como terminado`} />}>
      {others.length > 1 && (
        <View className="flex-row flex-wrap gap-2">
          {others.map((b) => (
            <Chip key={b.id} label={titleOf(b)} selected={b.id === book.id} onPress={() => onPick(b.id)} />
          ))}
        </View>
      )}

      {copies > 0 && (
        <View className="flex-row flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-700 bg-ink-950 px-3 py-2">
          <Text className="flex-1 text-[13px] text-ink-300">Este libro está cargado {copies + 1} veces.</Text>
          <SmallButton label="Dejar uno solo" onPress={onRemoveCopies} accessibilityLabel={`Dejar un solo ${title}`} />
        </View>
      )}

      <View className="flex-row gap-3.5">
        <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel={`Ver o editar ${title}`} style={{ width: 86 }}>
          <BookCover title={title} author={author} height={124} titleSize={15} plain />
        </Pressable>
        <View className="min-w-0 flex-1 gap-2">
          <View>
            <Text className="text-xl font-bold text-ink-100">{title}</Text>
            {!!author && <Text className="text-sm text-ink-400">{author}</Text>}
          </View>
          {total > 0 ? (
            <>
              <Text className="text-[13px] text-ink-300">
                Página {intFmt.format(Math.min(read, total))} de {intFmt.format(total)}
              </Text>
              <View
                className="h-2 overflow-hidden rounded-full bg-ink-800"
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: total, now: Math.min(read, total) }}>
                <View className="h-full rounded-full bg-shu-500" style={{ width: `${Math.min(read / total, 1) * 100}%` }} />
              </View>
              {daysLeft !== undefined && <Text className="text-xs text-shu-300">A tu ritmo lo terminás en {plural(daysLeft, 'día', 'días')}</Text>}
            </>
          ) : (
            <>
              <Text className="text-[13px] text-ink-300">{plural(read, 'página leída', 'páginas leídas')}</Text>
              <Pressable onPress={onEdit} accessibilityRole="button" className="self-start py-1">
                <Text className="text-[13px] font-semibold text-shu-300">Agregá cuántas páginas tiene ›</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>

      <View className="gap-2">
        <Text className={`text-[13px] ${flash ? 'font-semibold text-shu-300' : 'text-ink-300'}`} accessibilityLiveRegion="polite">
          {flash ?? '¿Cuánto leíste hoy? Un toque y queda anotado.'}
        </Text>
        <View className="flex-row gap-2">
          {QUICK_PAGES.map((n) => (
            <Pressable
              key={n}
              onPress={() => onAdd(n)}
              accessibilityRole="button"
              accessibilityLabel={`Anotar ${n} páginas de ${title}`}
              className="h-11 flex-1 items-center justify-center rounded-xl bg-shu-500 active:opacity-80">
              <Text numberOfLines={1} className="text-[15px] font-bold text-washi">
                +{n} págs
              </Text>
            </Pressable>
          ))}
          <Pressable
            onPress={() => setOtherOpen((o) => !o)}
            accessibilityRole="button"
            accessibilityLabel="Anotar otra cantidad de páginas"
            accessibilityState={{ expanded: otherOpen }}
            className={`h-11 flex-1 items-center justify-center rounded-xl border border-shu-400 ${otherOpen ? 'bg-shu-500/20' : ''}`}>
            <Text numberOfLines={1} className="text-[15px] text-shu-300">
              Otra
            </Text>
          </Pressable>
        </View>
        {otherOpen && (
          <View className="flex-row gap-2">
            <TextInput
              className="h-11 flex-1 rounded-xl border border-ink-700 bg-ink-950 px-3 text-base text-ink-100"
              keyboardType="number-pad"
              placeholder="¿Cuántas páginas?"
              placeholderTextColor={c['ink-500']}
              accessibilityLabel="Cantidad de páginas"
              value={otherText}
              onChangeText={setOtherText}
              onSubmitEditing={submitOther}
              returnKeyType="done"
              autoFocus
            />
            <Pressable
              onPress={submitOther}
              disabled={!otherValid}
              accessibilityRole="button"
              className={`h-11 items-center justify-center rounded-xl bg-shu-500 px-4 ${otherValid ? 'active:opacity-80' : 'opacity-40'}`}>
              <Text className="text-[15px] font-bold text-washi">Anotar</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Hero>
  );
}

/** Cuando no hay ningún libro "Leyendo": invita a empezar uno. */
function StartReading({ toRead, onStart, onAdd }: { toRead: Entry[]; onStart: (b: Entry) => void; onAdd: () => void }) {
  if (!toRead.length) {
    return (
      <Hero title="¿Qué estás leyendo?">
        <Text className="text-sm text-ink-300">Agregá el libro que estás leyendo y después anotá las páginas con un toque.</Text>
        <PrimaryButton label="+ Agregar libro" onPress={onAdd} />
      </Hero>
    );
  }
  return (
    <Hero title="¿Qué estás leyendo?">
      <Text className="text-sm text-ink-300">Elegí uno de tus libros para leer, o agregá otro.</Text>
      <View className="gap-2.5">
        {toRead.slice(0, 3).map((b) => (
          <View key={b.id} className="flex-row items-center gap-3">
            <View className="min-w-0 flex-1">
              <Text numberOfLines={1} className="text-[15px] font-semibold text-ink-100">
                {titleOf(b)}
              </Text>
              {!!authorOf(b) && (
                <Text numberOfLines={1} className="text-xs text-ink-400">
                  {authorOf(b)}
                </Text>
              )}
            </View>
            <SmallButton label="Empezar" strong onPress={() => onStart(b)} accessibilityLabel={`Empezar ${titleOf(b)}`} />
          </View>
        ))}
      </View>
      <SmallButton label="+ Agregar libro" onPress={onAdd} />
    </Hero>
  );
}

/** Tapa armada con el título y el autor: gris neutro con el lomo del color de la app. */
/** Tapa dibujada. `plain`: sin texto (en "Leyendo ahora" el título ya está al lado, no se repite). */
function BookCover({ title, author, height, titleSize, plain }: { title: string; author: string; height: number; titleSize: number; plain?: boolean }) {
  const short = shortAuthor(author);
  const shape = { height, borderTopLeftRadius: 6, borderBottomLeftRadius: 6, borderTopRightRadius: 10, borderBottomRightRadius: 10 };
  if (plain) {
    return (
      <View className="flex-row overflow-hidden bg-ink-800" style={shape}>
        <View className="w-1.5 bg-shu-600" />
        <View className="flex-1 items-center justify-center">
          <Text className="text-3xl opacity-70">📖</Text>
        </View>
      </View>
    );
  }
  return (
    <View className="flex-row overflow-hidden bg-ink-800" style={shape}>
      <View className="w-1.5 bg-shu-600" />
      <View className="min-w-0 flex-1 justify-between px-2 py-2.5">
        <Text numberOfLines={5} className="font-bold text-ink-100" style={{ fontFamily: SERIF, fontSize: titleSize, lineHeight: Math.round(titleSize * 1.15) }}>
          {title}
        </Text>
        {!!short && (
          <Text numberOfLines={2} className="text-[9px] text-ink-400">
            {short}
          </Text>
        )}
      </View>
    </View>
  );
}

/** "Para leer": tapas en grilla (3 columnas en el celular, más en la PC) con "Empezar". */
function ToReadSection({ books, onOpen, onStart, onAdd }: { books: Entry[]; onOpen: (b: Entry) => void; onStart: (b: Entry) => void; onAdd: () => void }) {
  const [width, setWidth] = useState(0);
  const [shown, setShown] = useState(PAGE_SIZE);
  const cols = Math.max(3, Math.floor((width + COVER_GAP) / (COVER_MIN_W + COVER_GAP)));
  const visible = books.slice(0, shown);
  const rows: Entry[][] = [];
  for (let i = 0; i < visible.length; i += cols) rows.push(visible.slice(i, i + cols));

  return (
    <Section title="Para leer" right={<SmallButton label="+ Agregar libro" onPress={onAdd} />}>
      {books.length === 0 ? (
        <Text className="text-sm text-ink-400">No tenés libros anotados para leer.</Text>
      ) : (
        <View className="gap-3" onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          {rows.map((row, i) => (
            <View key={i} className="flex-row" style={{ gap: COVER_GAP }}>
              {row.map((b) => (
                <View key={b.id} className="min-w-0 flex-1 gap-1.5">
                  <Pressable onPress={() => onOpen(b)} accessibilityRole="button" accessibilityLabel={`Ver o editar ${titleOf(b)}`}>
                    <BookCover title={titleOf(b)} author={authorOf(b)} height={138} titleSize={14} />
                  </Pressable>
                  <View className="flex-row items-center">
                    <View className="flex-1">
                      <SmallButton label="Empezar" onPress={() => onStart(b)} accessibilityLabel={`Empezar ${titleOf(b)}`} />
                    </View>
                    <TrashButton what={`el libro "${titleOf(b)}"`} detail={BOOK_DELETE_DETAIL} onDelete={() => deleteBook(b)} />
                  </View>
                </View>
              ))}
              {Array.from({ length: cols - row.length }, (_, k) => (
                <View key={`hueco-${k}`} className="flex-1" />
              ))}
            </View>
          ))}
          {books.length > shown && <SmallButton label="Ver más" onPress={() => setShown((n) => n + PAGE_SIZE)} />}
        </View>
      )}
    </Section>
  );
}

/** Barras de los últimos 14 días; hoy sin lectura va punteado. */
function PagesChart({ days, now }: { days: { date: string; pages: number }[]; now: string }) {
  const max = Math.max(...days.map((d) => d.pages), 1);
  const total = days.reduce((a, d) => a + d.pages, 0);
  return (
    <View accessible accessibilityLabel={`Últimos 14 días: ${plural(total, 'página', 'páginas')} en total`}>
      <View className="h-24 flex-row items-end gap-1">
        {days.map((d) =>
          d.pages > 0 ? (
            <View key={d.date} className="flex-1 rounded-t bg-shu-400" style={{ height: `${Math.max((d.pages / max) * 100, 6)}%` }} />
          ) : d.date === now ? (
            <View key={d.date} className="flex-1 rounded border-2 border-dashed border-shu-400" style={{ height: 22 }} />
          ) : (
            <View key={d.date} className="h-1 flex-1 rounded-sm bg-ink-800" />
          ),
        )}
      </View>
      <View className="mt-2 flex-row justify-between">
        <Text className="text-[11px] text-ink-500">{formatDay(days[0].date, { day: 'numeric', month: 'short' })}</Text>
        <Text className="text-[11px] text-ink-500">hoy</Text>
      </View>
    </View>
  );
}

function FinishedRow({ book, first, onPress }: { book: Entry; first: boolean; onPress: () => void }) {
  const title = titleOf(book);
  const author = authorOf(book);
  const st = stars(book.values.puntaje);
  return (
    <View className={`flex-row items-center ${first ? '' : 'border-t border-ink-800'}`}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={[title, author && `de ${author}`, st?.label].filter(Boolean).join(', ')}
        className="min-w-0 flex-1 flex-row items-center justify-between gap-3 py-3 pr-1 active:opacity-70">
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="text-[15px] font-semibold text-ink-100">
            {title}
          </Text>
          {!!author && (
            <Text numberOfLines={1} className="mt-0.5 text-xs text-ink-400">
              {author}
            </Text>
          )}
        </View>
        {!!st && <Text className="text-[15px] tracking-widest text-shu-300">{st.text}</Text>}
      </Pressable>
      <TrashButton what={`el libro "${title}"`} detail={BOOK_DELETE_DETAIL} onDelete={() => deleteBook(book)} />
    </View>
  );
}

function SessionRow({ session, now, first, onPress }: { session: Entry; now: string; first: boolean; onPress: () => void }) {
  const pages = numOf(session.values.paginas);
  const minutes = numOf(session.values.minutos);
  const book = String(session.values.libro ?? '').trim();
  const when = session.date === now ? 'Hoy' : formatDay(session.date, { weekday: 'short', day: 'numeric', month: 'short' });
  const main = [pages > 0 && plural(pages, 'página', 'páginas'), minutes > 0 && formatDuration(minutes)].filter(Boolean).join(' · ') || 'Sin páginas';
  return (
    <View className={`flex-row items-center ${first ? '' : 'border-t border-ink-800'}`}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${when}: ${main}${book ? `, ${book}` : ''}. Tocá para editar.`}
        className="min-w-0 flex-1 flex-row items-center gap-3 py-3 pr-1 active:opacity-70">
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="text-[15px] font-semibold text-ink-100">
            {main}
          </Text>
          {!!book && (
            <Text numberOfLines={1} className="mt-0.5 text-xs text-ink-400">
              {book}
            </Text>
          )}
        </View>
        <Text className="text-xs text-ink-500">{when}</Text>
      </Pressable>
      <TrashButton what={`la lectura de ${when === 'Hoy' ? 'hoy' : `el ${when}`} (${main})`} onDelete={() => useDb.getState().deleteEntry(session.id)} />
    </View>
  );
}

/** Lista que muestra los primeros y suma más con "Ver más". */
function PagedList({ items, render }: { items: Entry[]; render: (item: Entry, first: boolean) => ReactNode }) {
  const [shown, setShown] = useState(5);
  return (
    <View>
      {items.slice(0, shown).map((item, i) => render(item, i === 0))}
      {items.length > shown && (
        <View className="mt-2">
          <SmallButton label="Ver más" onPress={() => setShown((n) => n + 10)} />
        </View>
      )}
    </View>
  );
}

/** Fila que se despliega (Abandonados). */
function Collapsible({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <View className="rounded-2xl border border-ink-800 bg-ink-900">
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        className="h-[52px] flex-row items-center justify-between px-4 active:opacity-70">
        <Text className="text-[15px] text-ink-300">{label}</Text>
        <Text className="text-xl text-ink-400" style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
          ›
        </Text>
      </Pressable>
      {open && <View className="px-4 pb-3">{children}</View>}
    </View>
  );
}
