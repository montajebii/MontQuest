import React, { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapLibreRN, {
  CircleLayerStyle,
  Expression,
  OnPressEvent,
  SymbolLayerStyle,
} from '@maplibre/maplibre-react-native';
import type { FeatureCollection, Point } from 'geojson';
import { useFocusEffect } from '@react-navigation/native';
import PixelButton from '../components/PixelButton';
import XPBar from '../components/XPBar';
import QuestsTab from './QuestsTab';
import { getActiveQuests, getAllQuests } from '../db/quests';
import { onQuestCompleted } from '../services/rewardService';
import mapStyle8bit from '../assets/mapStyle8bit.json';
import {
  QUEST_MARKER_ACTIVE_PNG,
  QUEST_MARKER_DONE_PNG,
} from '../assets/questMarkerIcons';
import {
  DEFAULT_LATITUDE,
  DEFAULT_LONGITUDE,
} from '../utils/constants';
import { Quest } from '../types';

/**
 * Play screen (spec §4): TopBar (Coins|Level|XP), 8-bit MapLibre map with
 * clustered quest markers, FAB for adding quests and bottom tabs
 * [Map][Quests]. Proximity detection / the nearby dialog live app-wide in
 * `useProximityMonitor` + `NearbyQuestOverlay` — NOT here.
 *
 * Markers are GL-rendered (ShapeSource + SymbolLayer + Images, audit
 * F2.1): one platform-view-free layer scales to hundreds of quests, and
 * nearby quests cluster with a count at low zooms. Pixel icons are 16×16
 * PNG data URIs (src/assets/questMarkerIcons.ts).
 *
 * MapLibre notes: coordinates are [longitude, latitude]. Geofence rings
 * are meter-accurate via per-quest radius precomputed at zoom 0/22.
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

const buildMarkerShape = (quests: Quest[]): FeatureCollection => ({
  type: 'FeatureCollection',
  features: quests.map((q) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [q.longitude, q.latitude] },
    properties: { id: q.id, status: q.status },
  })),
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
const CLUSTER_CIRCLE_STYLE: CircleLayerStyle = {
  circleRadius: 14,
  circleColor: '#2fbf3f',
  circleStrokeWidth: 3,
  circleStrokeColor: '#0b0b12',
};
const CLUSTER_COUNT_STYLE: SymbolLayerStyle = {
  textField: ['get', 'point_count_abbreviated'],
  textFont: ['Noto Sans Bold'],
  textSize: 12,
  textColor: '#0b0b12',
};
const QUEST_POINT_STYLE: SymbolLayerStyle = {
  iconImage: [
    'match',
    ['get', 'status'],
    'active',
    'quest-marker-active',
    'quest-marker-done',
  ],
  iconAllowOverlap: true,
  iconSize: 1,
};
const CLUSTER_FILTER: Expression = ['has', 'point_count'];
const UNCLUSTERED_FILTER: Expression = ['!', ['has', 'point_count']];

interface CameraConfig {
  center: [number, number];
  zoom: number;
}

const MapScreen = ({ navigation }: any) => {
  const [tab, setTab] = useState<'map' | 'quests'>('map');
  const [activeQuests, setActiveQuests] = useState<Quest[]>([]);
  const [allQuests, setAllQuests] = useState<Quest[]>([]);
  const [cameraCfg, setCameraCfg] = useState<CameraConfig>({
    center: [DEFAULT_LONGITUDE, DEFAULT_LATITUDE],
    zoom: 14,
  });

  const mapRef = useRef<MapLibreRN.MapViewRef | null>(null);

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
  const markerShape = useMemo(() => buildMarkerShape(allQuests), [allQuests]);

  // Cluster tap → zoom in towards the cluster's location (audit R2.2).
  const handleMarkersPress = useCallback(async (event: OnPressEvent) => {
    const feature = event.features?.[0];
    if (!feature?.properties?.cluster) {return;}
    const geometry = feature.geometry as Point;
    const coords = geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) {return;}
    const currentZoom = (await mapRef.current?.getZoom()) ?? 12;
    setCameraCfg({
      center: [coords[0], coords[1]],
      zoom: Math.min(currentZoom + 2, 17),
    });
  }, []);

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
              ref={mapRef}
              style={StyleSheet.absoluteFill}
              mapStyle={mapStyle8bit}
              compassEnabled={false}
              logoEnabled={false}
              attributionEnabled>
              <MapLibreRN.Camera
                centerCoordinate={cameraCfg.center}
                zoomLevel={cameraCfg.zoom}
                animationMode="easeTo"
                animationDuration={400}
              />
              <MapLibreRN.UserLocation />
              <MapLibreRN.Images
                images={{
                  'quest-marker-active': QUEST_MARKER_ACTIVE_PNG,
                  'quest-marker-done': QUEST_MARKER_DONE_PNG,
                }}
              />

              {/* Geofence radius rings for active quests (meters-accurate) */}
              <MapLibreRN.ShapeSource id="geofences" shape={geofenceShape}>
                <MapLibreRN.CircleLayer id="geofence-fill" style={GEOFENCE_FILL_STYLE} />
                <MapLibreRN.CircleLayer
                  id="geofence-edge"
                  aboveLayerID="geofence-fill"
                  style={GEOFENCE_EDGE_STYLE}
                />
              </MapLibreRN.ShapeSource>

              {/* GL-rendered quest markers, clustered at low zooms (F2.1) */}
              <MapLibreRN.ShapeSource
                id="quest-markers"
                shape={markerShape}
                cluster
                clusterRadius={40}
                clusterMaxZoomLevel={14}
                onPress={handleMarkersPress}>
                <MapLibreRN.CircleLayer
                  id="quest-clusters"
                  filter={CLUSTER_FILTER}
                  style={CLUSTER_CIRCLE_STYLE}
                />
                <MapLibreRN.SymbolLayer
                  id="quest-cluster-count"
                  filter={CLUSTER_FILTER}
                  aboveLayerID="quest-clusters"
                  style={CLUSTER_COUNT_STYLE}
                />
                <MapLibreRN.SymbolLayer
                  id="quest-points"
                  filter={UNCLUSTERED_FILTER}
                  style={QUEST_POINT_STYLE}
                />
              </MapLibreRN.ShapeSource>
            </MapLibreRN.MapView>
            <TouchableOpacity
              style={styles.fab}
              accessibilityLabel="افزودن کوئست"
              accessibilityRole="button"
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
          accessibilityRole="tab"
          accessibilityLabel="نمایش نقشه"
          accessibilityState={{ selected: tab === 'map' }}
          onPress={() => setTab('map')}>
          <Text style={[styles.tabTxt, tab === 'map' && styles.tabTxtActive]}>نقشه</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'quests' && styles.tabActive]}
          accessibilityRole="tab"
          accessibilityLabel="نمایش فهرست کوئست‌ها"
          accessibilityState={{ selected: tab === 'quests' }}
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
