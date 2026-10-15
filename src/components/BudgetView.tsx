import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EXTERNAL_MONEY_FIELDS, findSub } from '../config/categories';
import { useDb } from '../lib/db';
import { formatMonth, monthKey, monthRange, today } from '../lib/dates';
import { formatCurrency, tagsOf } from '../lib/stats';
import { useThemeColors } from '../lib/theme';
import { parseNum } from './ItemsEditor';
import BackButton from './BackButton';
import ScreenTitle from './ScreenTitle';

const RUBROS = ['Supermercado', 'Verdulería', 'Carnicería', 'Almacén', 'Farmacia', 'Combustible', 'Transporte', 'Servicios', 'Salidas', 'Ropa', 'Hogar', 'Salud', 'Mascota', 'Educación', 'Entretenimiento', 'Suscripciones', 'Regalos', 'Viajes', 'Impuestos', 'Otros'];

function barColor(pct: number): string {
  if (pct >= 100) return '#a85445';
  if (pct >= 75) return '#c9a860';
  return '#6b9a72';
}

export default function BudgetView() {
  const c = useThemeColors();
  const profile = useDb((s) => s.userProfile[0]);
  const updateProfile = useDb((s) => s.updateUserProfile);
  const allEntries = useDb((s) => s.entries);

  const month = monthKey(today());
  const { start, end } = monthRange(month);

  const budgets: Record<string, number> = profile?.budgets ?? {};

  const { totalIncome, totalExpense } = useMemo(() => {
    const income = allEntries
      .filter((e) => e.categoryId === 'finanzas' && e.subId === 'ingresos' && e.date >= start && e.date <= end)
      .reduce((a, e) => a + (Number(e.values.monto) || 0), 0);
    const gastos = allEntries
      .filter((e) => e.categoryId === 'finanzas' && e.subId === 'gastos' && e.date >= start && e.date <= end)
      .reduce((a, e) => a + (Number(e.values.monto) || 0), 0);
    const externos = allEntries
      .filter((e) => e.categoryId !== 'finanzas' && e.date >= start && e.date <= end && EXTERNAL_MONEY_FIELDS.some((x) => x.category.id === e.categoryId && x.sub.id === e.subId))
      .reduce((a, e) => a + EXTERNAL_MONEY_FIELDS.filter((x) => x.category.id === e.categoryId && x.sub.id === e.subId).reduce((s, x) => s + (Number(e.values[x.field.key]) || 0), 0), 0);
    return { totalIncome: income, totalExpense: gastos + externos };
  }, [allEntries, start, end]);
  const savingsPct = totalIncome > 0 ? Math.round(((totalIncome - totalExpense) / totalIncome) * 100) : 0;
  const expenseBarPct = totalIncome > 0 ? Math.min(Math.round((totalExpense / totalIncome) * 100), 100) : 0;

  const spending = useMemo(() => {
    const map: Record<string, number> = {};
    const gastos = allEntries.filter((e) => e.categoryId === 'finanzas' && e.subId === 'gastos' && e.date >= start && e.date <= end);
    for (const e of gastos) {
      const amt = Number(e.values.monto) || 0;
      const tags = tagsOf(e.values.rubro);
      if (tags.length === 0) {
        map['Otros'] = (map['Otros'] ?? 0) + amt;
      } else {
        for (const t of tags) map[t] = (map[t] ?? 0) + amt;
      }
    }
    const externos = allEntries.filter(
      (e) => e.categoryId !== 'finanzas' && e.date >= start && e.date <= end && EXTERNAL_MONEY_FIELDS.some((x) => x.category.id === e.categoryId && x.sub.id === e.subId),
    );
    for (const e of externos) {
      const amt = EXTERNAL_MONEY_FIELDS.filter((x) => x.category.id === e.categoryId && x.sub.id === e.subId).reduce((a, x) => a + (Number(e.values[x.field.key]) || 0), 0);
      const f = findSub(e.categoryId, e.subId);
      const label = f ? f.sub.name : 'Otros';
      map[label] = (map[label] ?? 0) + amt;
    }
    return map;
  }, [allEntries, start, end]);

  const budgetedRubros = Object.keys(budgets).filter((k) => budgets[k] > 0);
  const totalBudget = budgetedRubros.reduce((a, k) => a + budgets[k], 0);
  const totalSpent = budgetedRubros.reduce((a, k) => a + (spending[k] ?? 0), 0);
  const totalPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  const [editingRubro, setEditingRubro] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const openEdit = (rubro: string) => {
    setEditingRubro(rubro);
    setEditAmount(budgets[rubro] ? String(budgets[rubro]) : '');
  };

  const saveEdit = () => {
    if (!editingRubro) return;
    const val = parseNum(editAmount);
    const next = { ...budgets };
    if (val > 0) next[editingRubro] = val;
    else delete next[editingRubro];
    updateProfile({ budgets: next });
    setEditingRubro(null);
  };

  const removeRubro = () => {
    if (!editingRubro) return;
    const next = { ...budgets };
    delete next[editingRubro];
    updateProfile({ budgets: next });
    setEditingRubro(null);
  };

  const availableRubros = RUBROS.filter((r) => !budgets[r]);

  const addRubro = (rubro: string) => {
    setShowAdd(false);
    openEdit(rubro);
  };

  return (
    <SafeAreaView className="flex-1 bg-ink-950" edges={['top']}>
      <ScrollView className="flex-1 px-4" contentContainerClassName="gap-4 pb-10 pt-4">
        <View className="flex-row items-center gap-2">
          <BackButton />
          <ScreenTitle categoryId="finanzas" subId="presupuestos" />
        </View>

        {/* ── Resumen general ── */}
        <View className="overflow-hidden rounded-2xl border border-ink-800 bg-ink-900 p-5">
          <Text className="text-sm text-ink-400">Presupuesto de {formatMonth(month).toLowerCase()}</Text>
          {totalBudget > 0 ? (
            <>
              <View className="mt-2 flex-row items-baseline gap-1">
                <Text className={`text-3xl font-bold ${totalPct >= 100 ? 'text-kurenai-400' : 'text-ink-100'}`}>{formatCurrency(totalSpent, 'ARS')}</Text>
                <Text className="text-base text-ink-500"> de {formatCurrency(totalBudget, 'ARS')}</Text>
              </View>
              <View className="mt-3 h-3 overflow-hidden rounded-full bg-ink-800">
                <View className="h-full rounded-full" style={{ width: `${Math.min(totalPct, 100)}%`, backgroundColor: barColor(totalPct) }} />
              </View>
              <Text className="mt-2 text-sm text-ink-400">
                {totalPct >= 100 ? (
                  <>Te pasaste por <Text className="font-semibold text-kurenai-400">{formatCurrency(totalSpent - totalBudget, 'ARS')}</Text></>
                ) : (
                  <>Te quedan <Text className="font-semibold text-moss-400">{formatCurrency(totalBudget - totalSpent, 'ARS')}</Text></>
                )}
              </Text>
            </>
          ) : (
            <Text className="mt-2 text-sm text-ink-500">{'Todavía no armaste ningún presupuesto. Tocá "+ Agregar categoría" para empezar.'}</Text>
          )}
        </View>

        {/* ── Ingreso vs Gasto ── */}
        {(totalIncome > 0 || totalExpense > 0) && (
          <View className="overflow-hidden rounded-2xl border border-ink-800 bg-ink-900 p-5">
            <Text className="mb-3 text-sm text-ink-400">Ingreso vs gasto</Text>
            <View className="gap-3">
              <View>
                <View className="mb-1.5 flex-row items-center justify-between">
                  <View className="flex-row items-center gap-1.5">
                    <View className="h-2 w-2 rounded-full bg-moss-400" />
                    <Text className="text-xs text-ink-500">Ingresos</Text>
                  </View>
                  <Text className="text-sm font-semibold text-moss-400" style={{ fontVariant: ['tabular-nums'] }}>{formatCurrency(totalIncome, 'ARS')}</Text>
                </View>
                <View className="h-2.5 overflow-hidden rounded-full bg-ink-800">
                  <View className="h-full rounded-full bg-moss-400" style={{ width: '100%' }} />
                </View>
              </View>
              <View>
                <View className="mb-1.5 flex-row items-center justify-between">
                  <View className="flex-row items-center gap-1.5">
                    <View className="h-2 w-2 rounded-full bg-kurenai-400" />
                    <Text className="text-xs text-ink-500">Gastos</Text>
                  </View>
                  <Text className="text-sm font-semibold text-kurenai-400" style={{ fontVariant: ['tabular-nums'] }}>{formatCurrency(totalExpense, 'ARS')}</Text>
                </View>
                <View className="h-2.5 overflow-hidden rounded-full bg-ink-800">
                  <View className="h-full rounded-full bg-kurenai-400" style={{ width: `${expenseBarPct}%` }} />
                </View>
              </View>
            </View>
            <View className="mt-3 items-center border-t border-ink-800 pt-3">
              {savingsPct >= 0 ? (
                <Text className="text-sm text-ink-400">
                  Ahorraste el <Text className="font-bold text-moss-400">{savingsPct}%</Text> de tus ingresos
                </Text>
              ) : (
                <Text className="text-sm text-ink-400">
                  Gastaste <Text className="font-bold text-kurenai-400">{Math.abs(savingsPct)}%</Text> más de lo que ingresaste
                </Text>
              )}
            </View>
          </View>
        )}

        {/* ── Por categoría ── */}
        {budgetedRubros.length > 0 && (
          <View>
            <Text className="mb-2 font-bold text-ink-100">Por categoría</Text>
            <View className="gap-2.5">
              {budgetedRubros
                .sort((a, b) => (spending[b] ?? 0) / budgets[b] - (spending[a] ?? 0) / budgets[a])
                .map((rubro) => {
                  const limit = budgets[rubro];
                  const spent = spending[rubro] ?? 0;
                  const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
                  const color = barColor(pct);
                  return (
                    <Pressable key={rubro} onPress={() => openEdit(rubro)} className="rounded-xl border border-ink-800 bg-ink-900 p-4">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-sm font-medium text-ink-100">{rubro}</Text>
                        <Text className="text-xs text-ink-500" style={{ fontVariant: ['tabular-nums'] }}>
                          {formatCurrency(spent, 'ARS')} / {formatCurrency(limit, 'ARS')}
                        </Text>
                      </View>
                      <View className="mt-2 h-2 overflow-hidden rounded-full bg-ink-800">
                        <View className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
                      </View>
                      <View className="mt-1.5 flex-row items-center justify-between">
                        <Text className="text-xs" style={{ color }}>{pct}%</Text>
                        {pct >= 100 ? (
                          <Text className="text-xs text-kurenai-400">excedido por {formatCurrency(spent - limit, 'ARS')}</Text>
                        ) : (
                          <Text className="text-xs text-ink-500">quedan {formatCurrency(limit - spent, 'ARS')}</Text>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
            </View>
          </View>
        )}

        {/* ── Agregar categoría ── */}
        {availableRubros.length > 0 && (
          <View>
            <Pressable onPress={() => setShowAdd(!showAdd)} className="flex-row items-center gap-2 rounded-xl border border-dashed border-ink-700 bg-ink-900/50 px-4 py-3">
              <Text className="text-lg text-shu-400">+</Text>
              <Text className="text-sm font-medium text-shu-400">Agregar categoría</Text>
            </Pressable>
            {showAdd && (
              <View className="mt-2 flex-row flex-wrap gap-2">
                {availableRubros.map((r) => (
                  <Pressable key={r} onPress={() => addRubro(r)} className="rounded-xl border border-ink-700 bg-ink-900 px-3.5 py-2">
                    <Text className="text-sm text-ink-300">{r}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* ── Modal de edición de presupuesto ── */}
      {editingRubro !== null && (
        <Modal transparent animationType="fade" onRequestClose={() => setEditingRubro(null)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <Pressable className="flex-1 items-center justify-center bg-black/60 px-6" onPress={() => setEditingRubro(null)}>
              <Pressable className="w-full max-w-sm rounded-2xl border border-ink-800 bg-ink-900 p-5" onPress={(e) => e.stopPropagation()}>
                <Text className="text-lg font-bold text-ink-100">{editingRubro}</Text>
                <Text className="mt-1 text-sm text-ink-500">Límite mensual para esta categoría</Text>
                <View className="mt-4 flex-row items-baseline gap-1 rounded-xl bg-ink-950/60 px-4 py-3">
                  <Text className="text-xl text-ink-400">$</Text>
                  <TextInput
                    autoFocus
                    keyboardType="decimal-pad"
                    className="flex-1 text-2xl font-bold text-ink-100"
                    placeholder="0"
                    placeholderTextColor={c['ink-600']}
                    value={editAmount}
                    onChangeText={setEditAmount}
                  />
                </View>
                {(spending[editingRubro] ?? 0) > 0 && (
                  <Text className="mt-2 text-xs text-ink-500">Gastaste {formatCurrency(spending[editingRubro] ?? 0, 'ARS')} este mes en {editingRubro}.</Text>
                )}
                <View className="mt-4 flex-row gap-2">
                  {!!budgets[editingRubro] && (
                    <Pressable onPress={removeRubro} className="items-center justify-center rounded-lg px-4 py-2.5">
                      <Text className="font-medium text-kurenai-400">Quitar</Text>
                    </Pressable>
                  )}
                  <Pressable onPress={saveEdit} className="flex-1 items-center justify-center rounded-lg bg-shu-500 py-2.5">
                    <Text className="font-medium text-washi">Guardar</Text>
                  </Pressable>
                </View>
              </Pressable>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>
      )}
    </SafeAreaView>
  );
}
