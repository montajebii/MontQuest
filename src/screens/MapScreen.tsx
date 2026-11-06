import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';
import { useFocusEffect } from '@react-navigation/native';
import PixelButton from '../components/PixelButton';
import XPBar from '../components/XPBar';
import QuestsTab from './QuestsTab';
import { getActiveQuests, getAllQuests } from '../db/quests';
import { onQuestCompleted } from '../services/rewardService';
import { Quest } from '../types';

/**
 * Play screen (spec §4): TopBar (Coins|Level|XP), map with quest markers,
 * FAB for adding quests and bottom tabs [Map][Quests].
 * Proximity detection / the nearby dialog live app-wide in
 * `useProximityMonitor` + `NearbyQuestOverlay` — NOT here, so they work
 * from any screen (and in the background).
 */
const MapScreen = ({ navigation }: any) => {
  const [tab, setTab] = useState<'map' | 'quests'>('map');
  const [activeQuests, setActiveQuests] = useState<Quest[]>([]);
  const [allQuests, setAllQuests] = useState<Quest[]>([]);

  const loadQuests = useCallback(async () => {
    setActiveQuests(await getActiveQuests());
    setAllQuests(await getAllQuests());
  }, []);

  // Reload on focus (e.g. returning from the AddQuest modal) and whenever
  // any quest completes (confirm dialog at App level or manual completion).
  useFocusEffect(
    useCallback(() => {
      loadQuests().catch(() => {});
      return onQuestCompleted(() => {
        loadQuests().catch(() => {});
      });
    }, [loadQuests]),
  );

  const handleQuestsChanged = useCallback(() => {
    loadQuests().catch(() => {});
  }, [loadQuests]);

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.topBarMain}>
          <XPBar />
        </View>
        <PixelButton
          title="خانه"
          style={styles.homeBtn}
          onPress={() => navigation.navigate('Home')}
        />
      </View>

      <View style={styles.body}>
        {tab === 'map' ? (
          <View style={styles.mapWrap}>
            <MapView style={StyleSheet.absoluteFill} showsUserLocation>
              {allQuests.map((q) => (
                <Marker
                  key={q.id}
                  coordinate={{ latitude: q.latitude, longitude: q.longitude }}
                  title={q.title}
                  description={q.task}
                  pinColor={q.status === 'active' ? '#00e676' : '#9e9e9e'}
                />
              ))}
              {activeQuests.map((q) => (
                <Circle
                  key={`c-${q.id}`}
                  center={{ latitude: q.latitude, longitude: q.longitude }}
                  radius={q.radius}
                  strokeWidth={1}
                  strokeColor="rgba(0,230,118,0.6)"
                  fillColor="rgba(0,230,118,0.08)"
                />
              ))}
            </MapView>
            <TouchableOpacity
              style={styles.fab}
              accessibilityLabel="افزودن کوئست"
              onPress={() => navigation.navigate('AddQuest')}>
              <Text style={styles.fabTxt}>+</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <QuestsTab navigation={navigation} onChanged={handleQuestsChanged} />
        )}
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'map' && styles.tabActive]}
          onPress={() => setTab('map')}>
          <Text style={[styles.tabTxt, tab === 'map' && styles.tabTxtActive]}>نقشه</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'quests' && styles.tabActive]}
          onPress={() => setTab('quests')}>
          <Text style={[styles.tabTxt, tab === 'quests' && styles.tabTxtActive]}>
            کوئست‌ها
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  topBar: { flexDirection: 'row-reverse', alignItems: 'flex-start' },
  topBarMain: { flex: 1 },
  homeBtn: { marginTop: 8, marginHorizontal: 8 },
  body: { flex: 1 },
  mapWrap: { flex: 1 },
  fab: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    width: 56,
    height: 56,
    backgroundColor: '#111',
    borderWidth: 3,
    borderColor: '#0ff',
    shadowColor: '#f0f',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabTxt: { color: '#0ff', fontSize: 28, lineHeight: 32, fontWeight: 'bold' },
  tabs: {
    flexDirection: 'row-reverse',
    borderTopWidth: 3,
    borderTopColor: '#fff',
    backgroundColor: '#000',
  },
  tabBtn: { flex: 1, padding: 12, alignItems: 'center' },
  tabActive: { backgroundColor: '#111', borderTopColor: '#0ff' },
  tabTxt: { color: '#888', fontFamily: 'monospace', fontSize: 16, letterSpacing: 2 },
  tabTxtActive: { color: '#0ff', fontWeight: 'bold' },
});

export default MapScreen;
