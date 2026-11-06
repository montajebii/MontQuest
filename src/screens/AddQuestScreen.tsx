import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import MapLibreRN, { Expression, CircleLayerStyle } from '@maplibre/maplibre-react-native';
import type { FeatureCollection } from 'geojson';
import PixelButton from '../components/PixelButton';
import PixelMarker from '../components/PixelMarker';
import { addQuest } from '../db/quests';
import {
  getCurrentLocation,
  getDefaultRadiusMeters,
  syncGeofences,
} from '../services/locationService';
import {
  DEFAULT_LATITUDE,
  DEFAULT_LONGITUDE,
} from '../utils/constants';
import mapStyle8bit from '../assets/mapStyle8bit.json';

/**
 * Add-quest form (spec §4, step 10-6): title, task, location picked on the
 * 8-bit MapLibre map (tap to place the pixel marker), and a geofence radius
 * with a live meter-accurate preview ring.
 */

// CircleLayer radius is screen-space — same meters trick as MapScreen.
const metersPerPixelAtZoom0 = (lat: number): number =>
  156543.03392 * Math.cos((lat * Math.PI) / 180);

const radiusExpr = (key: string, edgeKey: string): Expression => [
  'interpolate',
  ['exponential', 2],
  ['zoom'],
  0,
  ['get', key],
  22,
  ['get', edgeKey],
];

// Static MapLibre layer styles for the radius preview.
const PREVIEW_FILL_STYLE: CircleLayerStyle = {
  circleRadius: radiusExpr('r0', 'r22'),
  circleColor: '#2fbf3f',
  circleOpacity: 0.14,
  circlePitchAlignment: 'map',
};
const PREVIEW_EDGE_STYLE: CircleLayerStyle = {
  circleRadius: radiusExpr('r0e', 'r22e'),
  circleColor: '#2fbf3f',
  circleOpacity: 0.9,
  circlePitchAlignment: 'map',
};

const AddQuestScreen = ({ navigation }: any) => {
  const [title, setTitle] = useState('');
  const [task, setTask] = useState('');
  const [coord, setCoord] = useState({ latitude: DEFAULT_LATITUDE, longitude: DEFAULT_LONGITUDE });
  const [radius, setRadius] = useState('');
  const cameraRef = useRef<MapLibreRN.CameraRef | null>(null);

  useEffect(() => {
    (async () => {
      setRadius(String(await getDefaultRadiusMeters()));
      try {
        const pos = await getCurrentLocation();
        setCoord(pos);
        cameraRef.current?.flyTo([pos.longitude, pos.latitude], 600);
      } catch {}
    })();
  }, []);

  const radiusN = parseFloat(radius);

  const previewShape: FeatureCollection = useMemo(() => {
    const mpp0 = metersPerPixelAtZoom0(coord.latitude);
    const r0 = Number.isFinite(radiusN) && radiusN > 0 ? radiusN / mpp0 : 0;
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [coord.longitude, coord.latitude] },
          properties: { r0, r22: r0 * 2 ** 22, r0e: r0 + 1.5, r22e: r0 * 2 ** 22 + 1.5 },
        },
      ],
    };
  }, [coord.latitude, coord.longitude, radiusN]);

  const handleUseMyLocation = useCallback(async () => {
    try {
      const pos = await getCurrentLocation();
      setCoord(pos);
      cameraRef.current?.flyTo([pos.longitude, pos.latitude], 600);
    } catch (e) {
      Alert.alert('خطا', 'دریافت موقعیت فعلی ناموفق بود — روی نقشه انتخاب کنید');
    }
  }, []);

  const handleMapPress = useCallback((feature: any) => {
    const c = feature?.geometry?.coordinates;
    if (Array.isArray(c) && c.length >= 2) {
      setCoord({ longitude: c[0], latitude: c[1] });
    }
  }, []);

  const handleSave = async () => {
    if (!title.trim() || !task.trim()) {
      Alert.alert('خطا', 'عنوان و شرح الزامی است');
      return;
    }
    if (!Number.isFinite(radiusN) || radiusN <= 0) {
      Alert.alert('خطا', 'شعاع باید عددی مثبت باشد');
      return;
    }
    try {
      await addQuest({
        title: title.trim(),
        task: task.trim(),
        latitude: coord.latitude,
        longitude: coord.longitude,
        radius: radiusN,
      });
      await syncGeofences();
      navigation.goBack();
    } catch (e) {
      Alert.alert('خطا', 'ذخیره کوئست انجام نشد');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>عنوان</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} />

      <Text style={styles.label}>شرح کار</Text>
      <TextInput style={styles.input} value={task} onChangeText={setTask} multiline />

      <Text style={styles.label}>موقعیت روی نقشه (برای انتخاب، روی نقشه بزنید)</Text>
      <View style={styles.mapBox}>
        <MapLibreRN.MapView
          style={StyleSheet.absoluteFill}
          mapStyle={mapStyle8bit}
          onPress={handleMapPress}
          compassEnabled={false}
          logoEnabled={false}
          attributionEnabled>
          <MapLibreRN.Camera
            centerCoordinate={[DEFAULT_LONGITUDE, DEFAULT_LATITUDE]}
            zoomLevel={14}
            animationDuration={0}
            ref={(r: MapLibreRN.CameraRef | null) => {
              cameraRef.current = r;
            }}
          />
          <MapLibreRN.ShapeSource id="radiusPreview" shape={previewShape}>
            <MapLibreRN.CircleLayer id="preview-fill" style={PREVIEW_FILL_STYLE} />
            <MapLibreRN.CircleLayer
              id="preview-edge"
              aboveLayerID="preview-fill"
              style={PREVIEW_EDGE_STYLE}
            />
          </MapLibreRN.ShapeSource>
          <MapLibreRN.PointAnnotation
            id="picked"
            coordinate={[coord.longitude, coord.latitude]}>
            <PixelMarker active />
          </MapLibreRN.PointAnnotation>
        </MapLibreRN.MapView>
      </View>

      <View style={styles.radiusRow}>
        <View style={styles.radiusField}>
          <Text style={styles.label}>شعاع (متر)</Text>
          <TextInput
            style={styles.input}
            value={radius}
            onChangeText={setRadius}
            keyboardType="numeric"
          />
        </View>
        <PixelButton title="موقعیت من" onPress={handleUseMyLocation} style={styles.locBtn} />
      </View>

      <PixelButton title="ذخیره" onPress={handleSave} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  content: { padding: 16 },
  label: { color: '#0ff', fontFamily: 'monospace', marginTop: 12 },
  input: {
    backgroundColor: '#111',
    borderColor: '#fff',
    borderWidth: 2,
    color: '#fff',
    fontFamily: 'monospace',
    padding: 8,
    marginTop: 4,
  },
  mapBox: { height: 260, marginTop: 6, borderWidth: 2, borderColor: '#fff' },
  radiusRow: { flexDirection: 'row-reverse', alignItems: 'flex-end', gap: 12 },
  radiusField: { flex: 1 },
  locBtn: { marginBottom: 6 },
});

export default AddQuestScreen;
