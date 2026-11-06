import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import PixelButton from '../components/PixelButton';
import {
  deleteQuest,
  getActiveQuests,
  getQuestHistoryWithTitles,
} from '../db/quests';
import {
  completeQuestAndReward,
  onQuestCompleted,
} from '../services/rewardService';
import { removeQuestGeofence, syncGeofences } from '../services/locationService';
import { useGame } from '../state/GameContext';
import { COINS_PER_QUEST, XP_PER_QUEST } from '../utils/constants';
import { Quest, QuestHistoryEntry } from '../types';

interface Props {
  navigation: any;
  /** Notify the parent (MapScreen) so map markers stay in sync. */
  onChanged?: () => void;
}

const formatDate = (ts: number): string => new Date(ts).toLocaleString('fa-IR');

/**
 * Quests tab (spec §4/§3-15): live quests + completed history.
 * Tapping a live quest opens the detail dialog with manual completion
 * (same +10/+25 reward, per user decision) and delete (active quests only).
 */
const QuestsTab = ({ navigation, onChanged }: Props) => {
  const { refreshProfile } = useGame();
  const [live, setLive] = useState<Quest[]>([]);
  const [history, setHistory] = useState<QuestHistoryEntry[]>([]);
  const [selected, setSelected] = useState<Quest | null>(null);

  const load = useCallback(async () => {
    setLive(await getActiveQuests());
    setHistory(await getQuestHistoryWithTitles());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => {});
      // Keep live/history fresh when a quest completes via the App-level
      // confirm dialog while this tab is already visible.
      return onQuestCompleted(() => {
        load().catch(() => {});
      });
    }, [load]),
  );

  const refreshAll = useCallback(async () => {
    await load();
    onChanged?.();
  }, [load, onChanged]);

  const handleComplete = async () => {
    if (!selected) {return;}
    try {
      const reward = await completeQuestAndReward(selected.id);
      if (!reward) {
        Alert.alert('توجه', 'این کوئست قبلاً تکمیل شده است.');
      } else {
        await refreshProfile();
        await syncGeofences();
        await refreshAll();
      }
    } catch (e) {
      Alert.alert('خطا', 'ثبت پاداش انجام نشد.');
    }
    setSelected(null);
  };

  const handleDelete = async () => {
    if (!selected) {return;}
    try {
      await removeQuestGeofence(selected.id);
      await deleteQuest(selected.id);
      await syncGeofences();
      await refreshAll();
    } catch (e) {
      Alert.alert('خطا', 'حذف کوئست انجام نشد.');
    }
    setSelected(null);
  };

  const renderLive = ({ item }: { item: Quest }) => (
    <TouchableOpacity
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={`کوئست ${item.title} — مشاهدهٔ جزئیات`}
      onPress={() => setSelected(item)}>
      <Text style={styles.title}>⭕ {item.title}</Text>
      <Text style={styles.meta}>{item.task}</Text>
      <Text style={styles.metaSmall}>
        شعاع {item.radius} متر — {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
      </Text>
    </TouchableOpacity>
  );

  const renderHistory = ({ item }: { item: QuestHistoryEntry }) => (
    <View style={styles.row}>
      <Text style={styles.titleDim}>✅ {item.title ?? 'کوئست حذف‌شده'}</Text>
      <Text style={styles.metaSmall}>
        {formatDate(item.completed_at)} — 🪙 {item.coins_awarded} — {item.xp_awarded} XP
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <PixelButton title="+ کوئست جدید" onPress={() => navigation.navigate('AddQuest')} />
      </View>

      <Text style={styles.section}>کوئست‌های زنده ({live.length})</Text>
      <FlatList
        data={live}
        keyExtractor={(q) => String(q.id)}
        renderItem={renderLive}
        ListEmptyComponent={<Text style={styles.empty}>کوئست فعالی وجود ندارد.</Text>}
        style={styles.list}
      />

      <Text style={styles.section}>تاریخچهٔ کوئست‌ها ({history.length})</Text>
      <FlatList
        data={history}
        keyExtractor={(h) => String(h.id)}
        renderItem={renderHistory}
        ListEmptyComponent={<Text style={styles.empty}>هنوز کوئستی تکمیل نشده.</Text>}
        style={styles.list}
      />

      <Modal
        visible={selected !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}>
        <View style={styles.backdrop}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>{selected?.title}</Text>
            <Text style={styles.dialogMeta}>شرح: {selected?.task}</Text>
            <Text style={styles.dialogMeta}>
              موقعیت: {selected?.latitude.toFixed(5)}, {selected?.longitude.toFixed(5)} — شعاع:{' '}
              {selected?.radius} متر
            </Text>
            <Text style={styles.dialogMeta}>
              ایجاد: {selected ? formatDate(selected.created_at) : ''}
            </Text>
            <PixelButton
              title={`تکمیل دستی (🪙 ${COINS_PER_QUEST} + ${XP_PER_QUEST} XP)`}
              onPress={handleComplete}
            />
            <PixelButton title="حذف کوئست" onPress={handleDelete} />
            <PixelButton title="بستن" onPress={() => setSelected(null)} />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  toolbar: { paddingHorizontal: 12, paddingTop: 12 },
  section: {
    color: '#0ff',
    fontFamily: 'monospace',
    fontWeight: 'bold',
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 4,
  },
  list: { flex: 1 },
  row: { borderBottomColor: '#333', borderBottomWidth: 1, paddingVertical: 8, marginHorizontal: 12 },
  title: { color: '#0ff', fontFamily: 'monospace', fontSize: 16, fontWeight: 'bold' },
  titleDim: { color: '#8f8', fontFamily: 'monospace', fontSize: 15, fontWeight: 'bold' },
  meta: { color: '#aaa', fontFamily: 'monospace', fontSize: 12, marginTop: 2 },
  metaSmall: { color: '#777', fontFamily: 'monospace', fontSize: 11, marginTop: 2 },
  empty: { color: '#666', fontFamily: 'monospace', textAlign: 'center', marginTop: 8 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 24,
  },
  dialog: { backgroundColor: '#111', borderColor: '#fff', borderWidth: 3, padding: 16 },
  dialogTitle: {
    color: '#0ff',
    fontFamily: 'monospace',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  dialogMeta: { color: '#aaa', fontFamily: 'monospace', fontSize: 12, marginBottom: 4 },
});

export default QuestsTab;
