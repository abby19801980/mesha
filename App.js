import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ---------------------------------------------------------------
// Mesha - training tracker (stage 1: build programs, saved on the phone)
//
// A program has days (your split), a day has exercises,
// an exercise has sets, and each set has target reps and weight in kg.
// ---------------------------------------------------------------

const STORAGE_KEY = 'mesha:programs:v1';

const newId = () =>
  Date.now().toString() + Math.random().toString(36).slice(2, 7);
const newSet = () => ({ reps: '10', kg: '20' });
const newExercise = () => ({
  id: newId(),
  name: '',
  sets: [newSet(), newSet(), newSet()],
});
const newDay = () => ({ id: newId(), name: '', exercises: [newExercise()] });
const newProgram = () => ({ id: newId(), name: '', days: [newDay()] });

// Saved programs keep numbers; the editor works with text boxes.
const toDraft = (program) => ({
  ...program,
  days: program.days.map((day) => ({
    ...day,
    exercises: day.exercises.map((ex) => ({
      ...ex,
      sets: ex.sets.map((s) => ({ reps: String(s.reps), kg: String(s.kg) })),
    })),
  })),
});

const toNumber = (text) => {
  const n = parseFloat(String(text).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

export default function App() {
  const [programs, setPrograms] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState(null); // program being created/edited
  const [viewingId, setViewingId] = useState(null);

  // Load saved programs when the app opens.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((text) => {
        if (text) setPrograms(JSON.parse(text));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // Save every time the programs change.
  useEffect(() => {
    if (loaded) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(programs)).catch(
        () => {}
      );
    }
  }, [programs, loaded]);

  const saveDraft = () => {
    if (!draft.name.trim()) {
      Alert.alert('Give your program a name');
      return;
    }
    for (const day of draft.days) {
      if (!day.name.trim()) {
        Alert.alert('Every day needs a name', 'For example: Push day');
        return;
      }
      for (const ex of day.exercises) {
        if (!ex.name.trim()) {
          Alert.alert('Every exercise needs a name', `Check "${day.name}"`);
          return;
        }
      }
    }
    const cleaned = {
      id: draft.id,
      name: draft.name.trim(),
      days: draft.days.map((day) => ({
        id: day.id,
        name: day.name.trim(),
        exercises: day.exercises.map((ex) => ({
          id: ex.id,
          name: ex.name.trim(),
          sets: ex.sets.map((s) => ({
            reps: Math.round(toNumber(s.reps)),
            kg: toNumber(s.kg),
          })),
        })),
      })),
    };
    setPrograms((list) =>
      list.some((p) => p.id === cleaned.id)
        ? list.map((p) => (p.id === cleaned.id ? cleaned : p))
        : [...list, cleaned]
    );
    setDraft(null);
  };

  const deleteProgram = (program) => {
    Alert.alert('Delete program?', `"${program.name}" will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setPrograms((list) => list.filter((p) => p.id !== program.id));
          setViewingId(null);
        },
      },
    ]);
  };

  const viewing = programs.find((p) => p.id === viewingId);

  let screen;
  if (draft) {
    screen = (
      <Builder
        draft={draft}
        setDraft={setDraft}
        onSave={saveDraft}
        onCancel={() => setDraft(null)}
      />
    );
  } else if (viewing) {
    screen = (
      <Details
        program={viewing}
        onBack={() => setViewingId(null)}
        onEdit={() => setDraft(toDraft(viewing))}
        onDelete={() => deleteProgram(viewing)}
      />
    );
  } else {
    screen = (
      <Home
        programs={programs}
        onOpen={(p) => setViewingId(p.id)}
        onNew={() => setDraft(newProgram())}
      />
    );
  }

  return (
    <View style={styles.screen}>
      {screen}
      <StatusBar style="auto" />
    </View>
  );
}

// ------------------------------ Home ------------------------------

function Home({ programs, onOpen, onNew }) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Mesha</Text>
      <Text style={styles.subtitle}>Your training programs</Text>

      {programs.length === 0 && (
        <Text style={styles.muted}>
          No programs yet. Tap the button below to create your first one.
        </Text>
      )}

      {programs.map((p) => (
        <Pressable key={p.id} style={styles.card} onPress={() => onOpen(p)}>
          <Text style={styles.cardTitle}>{p.name}</Text>
          <Text style={styles.muted}>
            {p.days.length} {p.days.length === 1 ? 'day' : 'days'} per cycle
          </Text>
        </Pressable>
      ))}

      <Button title="+ New program" onPress={onNew} />
    </ScrollView>
  );
}

// ----------------------------- Details -----------------------------

function Details({ program, onBack, onEdit, onDelete }) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Button title="< Back" kind="secondary" onPress={onBack} />
      <Text style={styles.title}>{program.name}</Text>

      {program.days.map((day) => (
        <View key={day.id} style={styles.card}>
          <Text style={styles.cardTitle}>{day.name}</Text>
          {day.exercises.map((ex) => (
            <View key={ex.id} style={styles.exerciseBlock}>
              <Text style={styles.exerciseName}>{ex.name}</Text>
              {ex.sets.map((s, i) => (
                <Text key={i} style={styles.muted}>
                  Set {i + 1}: {s.reps} reps x {s.kg} kg
                </Text>
              ))}
            </View>
          ))}
        </View>
      ))}

      <Button title="Edit program" onPress={onEdit} />
      <Button title="Delete program" kind="danger" onPress={onDelete} />
    </ScrollView>
  );
}

// ----------------------------- Builder -----------------------------

function Builder({ draft, setDraft, onSave, onCancel }) {
  const setName = (name) => setDraft({ ...draft, name });

  const updateDays = (fn) => setDraft({ ...draft, days: fn(draft.days) });

  const updateDay = (dayId, fn) =>
    updateDays((days) => days.map((d) => (d.id === dayId ? fn(d) : d)));

  const updateExercise = (dayId, exId, fn) =>
    updateDay(dayId, (d) => ({
      ...d,
      exercises: d.exercises.map((e) => (e.id === exId ? fn(e) : e)),
    }));

  const updateSet = (dayId, exId, index, field, value) =>
    updateExercise(dayId, exId, (e) => ({
      ...e,
      sets: e.sets.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    }));

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Program</Text>

      <Text style={styles.label}>Program name</Text>
      <TextInput
        style={styles.input}
        value={draft.name}
        onChangeText={setName}
        placeholder="e.g. Push Pull Legs"
      />

      {draft.days.map((day, dayIndex) => (
        <View key={day.id} style={styles.card}>
          <Text style={styles.label}>Day {dayIndex + 1} name</Text>
          <TextInput
            style={styles.input}
            value={day.name}
            onChangeText={(text) =>
              updateDay(day.id, (d) => ({ ...d, name: text }))
            }
            placeholder="e.g. Push day"
          />

          {day.exercises.map((ex) => (
            <View key={ex.id} style={styles.exerciseBlock}>
              <Text style={styles.label}>Exercise</Text>
              <TextInput
                style={styles.input}
                value={ex.name}
                onChangeText={(text) =>
                  updateExercise(day.id, ex.id, (e) => ({ ...e, name: text }))
                }
                placeholder="e.g. Bench press"
              />

              {ex.sets.map((s, i) => (
                <View key={i} style={styles.setRow}>
                  <Text style={styles.setLabel}>Set {i + 1}</Text>
                  <TextInput
                    style={[styles.input, styles.smallInput]}
                    value={s.reps}
                    onChangeText={(t) =>
                      updateSet(day.id, ex.id, i, 'reps', t)
                    }
                    keyboardType="number-pad"
                  />
                  <Text style={styles.unit}>reps</Text>
                  <TextInput
                    style={[styles.input, styles.smallInput]}
                    value={s.kg}
                    onChangeText={(t) => updateSet(day.id, ex.id, i, 'kg', t)}
                    keyboardType="decimal-pad"
                  />
                  <Text style={styles.unit}>kg</Text>
                  <Pressable
                    onPress={() =>
                      updateExercise(day.id, ex.id, (e) => ({
                        ...e,
                        sets: e.sets.filter((_, n) => n !== i),
                      }))
                    }
                  >
                    <Text style={styles.remove}>X</Text>
                  </Pressable>
                </View>
              ))}

              <View style={styles.row}>
                <Button
                  title="+ Add set"
                  kind="secondary"
                  onPress={() =>
                    updateExercise(day.id, ex.id, (e) => {
                      const last = e.sets[e.sets.length - 1] || newSet();
                      return { ...e, sets: [...e.sets, { ...last }] };
                    })
                  }
                />
                <Button
                  title="Remove exercise"
                  kind="danger"
                  onPress={() =>
                    updateDay(day.id, (d) => ({
                      ...d,
                      exercises: d.exercises.filter((e) => e.id !== ex.id),
                    }))
                  }
                />
              </View>
            </View>
          ))}

          <Button
            title="+ Add exercise"
            kind="secondary"
            onPress={() =>
              updateDay(day.id, (d) => ({
                ...d,
                exercises: [...d.exercises, newExercise()],
              }))
            }
          />
          {draft.days.length > 1 && (
            <Button
              title="Remove this day"
              kind="danger"
              onPress={() =>
                updateDays((days) => days.filter((d) => d.id !== day.id))
              }
            />
          )}
        </View>
      ))}

      <Button
        title="+ Add day"
        kind="secondary"
        onPress={() => updateDays((days) => [...days, newDay()])}
      />

      <View style={styles.spacer} />
      <Button title="Save program" onPress={onSave} />
      <Button title="Cancel" kind="secondary" onPress={onCancel} />
    </ScrollView>
  );
}

// ----------------------------- Button -----------------------------

function Button({ title, onPress, kind }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        kind === 'secondary' && styles.buttonSecondary,
        kind === 'danger' && styles.buttonDanger,
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          kind === 'secondary' && styles.buttonTextSecondary,
          kind === 'danger' && styles.buttonTextDanger,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

// ----------------------------- Styles -----------------------------

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f4f5f7',
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
  },
  content: { padding: 20, paddingBottom: 60 },
  title: { fontSize: 30, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#555', marginBottom: 16 },
  muted: { color: '#666', fontSize: 14, marginVertical: 2 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
  },
  cardTitle: { fontSize: 20, fontWeight: '600', marginBottom: 4 },
  exerciseBlock: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  exerciseName: { fontSize: 16, fontWeight: '600' },
  label: { fontSize: 13, color: '#555', marginTop: 8, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#d0d3d9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  smallInput: { width: 60, textAlign: 'center' },
  setRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  setLabel: { width: 48, fontSize: 14 },
  unit: { marginHorizontal: 6, color: '#555' },
  remove: { color: '#c0392b', fontSize: 18, paddingHorizontal: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  spacer: { height: 12 },
  button: {
    backgroundColor: '#2f6fed',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonSecondary: { backgroundColor: '#e3e8f5' },
  buttonDanger: { backgroundColor: '#fbe4e1' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  buttonTextSecondary: { color: '#2f6fed' },
  buttonTextDanger: { color: '#c0392b' },
});
