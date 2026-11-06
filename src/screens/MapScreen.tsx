import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapLibreRN, { Expression, CircleLayerStyle } from '@maplibre/maplibre-react-native';
import type { FeatureCollection } from 'geojson';
import { useFocusEffect } from '@react-navigation/native';
import PixelButton from '../components/PixelButton';
import PixelMarker from '../components/PixelMarker';
import XPBar from '../components/XPBar';
import QuestsTab from './QuestsTab';
import { getActiveQuests, getAllQuests } from '../db/quests';
import { onQuestCompleted } from '../services/rewardService';
import mapStyle8bit from '../assets/mapStyle8bit.json';
import {
  DEFAULT_LATITUDE,
  DEFAULT_LONGITUDE,
} from '../utils/constants';
import { Quest } from '../types';

/**
 * Play screen (spec §4): TopBar (Coins|Level|XP), 8-bit MapLibre map with
 * quest markers, FAB for adding quests and bottom tabs [Map][Quests].
 * Proximity detection / the nearby dialog live app-wide in
 * `useProximityMonitor` + `NearbyQuestOverlay` — NOT here.
 *
 * MapLibre notes: coordinates are [longitude, latitude]. The 8-bit look
 * comes from src/assets/mapStyle8bit.json (client-side style JSON on top
 * of OpenFreeMap's free vector tiles — no API key anywhere).
 */

// MapLibre circleRadius is screen-space; to draw the geofence radius in
// METERS we precompute each quest's radius in screen points at zoom 0 and
// zoom 22 (metersPerPixel = 156543.03392·cos(lat)/2^zoom) and let the
// renderer interpolate exponentially between them. Accurate at every zoom.
const metersPerPixelAtZoom0 = (lat: number): number =>
  156543.03392 * Math.cos((lat * Math.PI) / 180);

const buildGeofenceShape = (quests: Quest[]): FeatureCollection => ({
  type: 'FeatureCollection',
  features: quests.map((q) => {
    const r0 = q.radius / metersPerPixelAtZoom0(q.latitude);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [q.longitude, q.latitude] },
      properties: {
        r0,
        r22: r0 * 2 ** 22,
        r0e: r0 + 1.5,
        r22e: r0 * 2 ** 22 + 1.5,
      },
    };
  }),
});

const radiusExpr = (key: string, edgeKey: string): Expression => [
  'interpolate',
  ['exponential', 2],
  ['zoom'],
  0,
  ['get', key],
  22,
  ['get', edgeKey],
];

// Static MapLibre layer styles (hoisted: never change between renders).
const GEOFENCE_FILL_STYLE: CircleLayerStyle = {
  circleRadius: radiusExpr('r0', 'r22'),
  circleColor: '#2fbf3f',
  circleOpacity: 0.14,
  circlePitchAlignment: 'map',
};
const GEOFENCE_EDGE_STYLE: CircleLayerStyle = {
  circleRadius: radiusExpr('r0e', 'r22e'),
  circleColor: '#2fbf3f',
  circleOpacity: 0.9,
  circlePitchAlignment: 'map',
};

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

  const geofenceShape = useMemo(() => buildGeofenceShape(activeQuests), [activeQuests]);

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
            <MapLibreRN.MapView
              style={StyleSheet.absoluteFill}
              mapStyle={mapStyle8bit}
              compassEnabled={false}
              logoEnabled={false}
              attributionEnabled>
              <MapLibreRN.Camera
                centerCoordinate={[DEFAULT_LONGITUDE, DEFAULT_LATITUDE]}
                zoomLevel={14}
                animationDuration={0}
              />
              <MapLibreRN.UserLocation />

              {/* Geofence radius rings for active quests (meters-accurate) */}
              <MapLibreRN.ShapeSource id="geofences" shape={geofenceShape}>
                <MapLibreRN.CircleLayer id="geofence-fill" style={GEOFENCE_FILL_STYLE} />
                <MapLibreRN.CircleLayer
                  id="geofence-edge"
                  aboveLayerID="geofence-fill"
                  style={GEOFENCE_EDGE_STYLE}
                />
              </MapLibreRN.ShapeSource>

              {/* Pixel square markers: green = active, gray = completed */}
              {allQuests.map((q) => (
                <MapLibreRN.PointAnnotation
                  key={String(q.id)}
                  id={`quest-${q.id}`}
                  coordinate={[q.longitude, q.latitude]}
                  title={q.title}
                  onSelected={() => undefined}>
                  <PixelMarker active={q.status === 'active'} />
                </MapLibreRN.PointAnnotation>
              ))}
            </MapLibreRN.MapView>
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
