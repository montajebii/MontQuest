import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import MapLibreRN, {
  CircleLayerStyle,
  type Expression,
} from '@maplibre/maplibre-react-native';
import type { FeatureCollection, Feature, Point } from 'geojson';
import PixelButton from '../components/PixelButton';
import PixelMarker from '../components/PixelMarker';
import { addQuest, getQuestById, updateQuest } from '../db/quests';
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
import { MAP_TEXTURES } from '../assets/mapTextures';

/**
 * Add-quest form — also the EDIT form (route.params.questId): title, task,
 * location picked on the 8-bit MapLibre map, and a geofence radius with a
 * live meter-accurate preview ring.
 *
 * Device-QA isolation (camera lock fix): the map lives in a memoized child
 * whose props only change with coord/radius — typing in the form fields
 * never re-renders the MapView, and the Camera carries NO state-wired
 * props (defaultSettings for the initial view; every movement is
 * imperative through the shared cameraRef).
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

export interface QuestCoord {
  latitude: number;
  longitude: number;
}

interface PickerProps {
  coord: QuestCoord;
  radius: number;
  /** Tap on the map — parent stores the picked coordinate. */
  onPress: (longitude: number, latitude: number) => void;
  /** Parent-owned camera ref: attach it so the parent can fly imperatively. */
  cameraRef: React.MutableRefObject<MapLibreRN.CameraRef | null>;
}

/** Memoized map picker — re-renders ONLY when coord/radius change. */
const MapPicker = memo(function MapPicker({
  coord,
  radius,
  onPress,
  cameraRef,
}: PickerProps) {
  const previewShape: FeatureCollection = useMemo(() => {
    const mpp0 = metersPerPixelAtZoom0(coord.latitude);
    const r0 = radius > 0 ? radius / mpp0 : 0;
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
  }, [coord.latitude, coord.longitude, radius]);

  return (
    <View style={styles.mapBox}>
      <MapLibreRN.MapView
        style={StyleSheet.absoluteFill}
        mapStyle={mapStyle8bit}
        onPress={(e: Feature) => {
          const geometry = e?.geometry as Point | null;
          const c = geometry?.coordinates;
          if (Array.isArray(c) && c.length >= 2) {
            onPress(c[0], c[1]);
          }
        }}
        compassEnabled={false}
        logoEnabled={false}
        attributionEnabled>
        <MapLibreRN.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [DEFAULT_LONGITUDE, DEFAULT_LATITUDE],
            zoomLevel: 14,
            heading: 0,
          }}
        />
        <MapLibreRN.Images images={MAP_TEXTURES} />
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
  );
});

const AddQuestScreen = ({ navigation, route }: any) => {
  const questId: number | undefined = route?.params?.questId;
  const isEdit = questId != null;

  const [title, setTitle] = useState('');
  const [task, setTask] = useState('');
  const [coord, setCoord] = useState<QuestCoord>({
    latitude: DEFAULT_LATITUDE,
    longitude: DEFAULT_LONGITUDE,
  });
  const [radius, setRadius] = useState('');
  const pickerCameraRef = useRef<MapLibreRN.CameraRef | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: isEdit ? 'ویرایش کوئست' : 'افزودن کوئست' });
  }, [isEdit, navigation]);

  useEffect(() => {
    (async () => {
      if (isEdit && questId != null) {
        // Edit mode: prefill from DB and fly the camera to the quest.
        try {
          const quest = await getQuestById(questId);
          if (quest) {
            setTitle(quest.title);
            setTask(quest.task);
            setCoord({ latitude: quest.latitude, longitude: quest.longitude });
            setRadius(String(quest.radius));
            pickerCameraRef.current?.setCamera({
              centerCoordinate: [quest.longitude, quest.latitude],
              zoomLevel: 14,
              heading: 0,
              animationDuration: 600,
            });
          }
        } catch {}
      } else {
        setRadius(String(await getDefaultRadiusMeters()));
        try {
          const pos = await getCurrentLocation();
          setCoord(pos);
          pickerCameraRef.current?.setCamera({
            centerCoordinate: [pos.longitude, pos.latitude],
            zoomLevel: 14,
            heading: 0,
            animationDuration: 600,
          });
        } catch {}
      }
    })();
  }, [isEdit, questId]);

  const radiusN = parseFloat(radius);

  const handleUseMyLocation = useCallback(async () => {
    try {
      const pos = await getCurrentLocation();
      setCoord(pos);
      pickerCameraRef.current?.setCamera({
        centerCoordinate: [pos.longitude, pos.latitude],
        zoomLevel: 14,
        heading: 0,
        animationDuration: 600,
      });
    } catch (e) {
      Alert.alert('خطا', 'دریافت موقعیت فعلی ناموفق بود — روی نقشه انتخاب کنید');
    }
  }, []);

  const handleMapPress = useCallback((longitude: number, latitude: number) => {
    setCoord({ latitude, longitude });
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
    const fields = {
      title: title.trim(),
      task: task.trim(),
      latitude: coord.latitude,
      longitude: coord.longitude,
      radius: radiusN,
    };
    try {
      if (isEdit && questId != null) {
        await updateQuest(questId, fields);
      } else {
        await addQuest(fields);
      }
      // Re-register geofences so the new position/radius takes effect.
      await syncGeofences();
      navigation.goBack();
    } catch (e) {
      Alert.alert('خطا', isEdit ? 'ویرایش کوئست انجام نشد' : 'ذخیره کوئست انجام نشد');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>عنوان</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        accessibilityLabel="عنوان کوئست"
      />

      <Text style={styles.label}>شرح کار</Text>
      <TextInput
        style={styles.input}
        value={task}
        onChangeText={setTask}
        multiline
        accessibilityLabel="شرح کار کوئست"
      />

      <Text style={styles.label}>موقعیت روی نقشه (برای انتخاب، روی نقشه بزنید)</Text>
      <MapPicker
        coord={coord}
        radius={Number.isFinite(radiusN) ? radiusN : 0}
        onPress={handleMapPress}
        cameraRef={pickerCameraRef}
      />

      <View style={styles.radiusRow}>
        <View style={styles.radiusField}>
          <Text style={styles.label}>شعاع (متر)</Text>
          <TextInput
            style={styles.input}
            value={radius}
            onChangeText={setRadius}
            keyboardType="numeric"
            accessibilityLabel="شعاع ژئوفنس به متر"
          />
        </View>
        <PixelButton
          title="موقعیت من"
          accessibilityLabel="انتخاب موقعیت فعلی من روی نقشه"
          onPress={handleUseMyLocation}
          style={styles.locBtn}
        />
      </View>

      <PixelButton
        title={isEdit ? 'ذخیرهٔ تغییرات' : 'ذخیره'}
        accessibilityLabel={isEdit ? 'ذخیرهٔ تغییرات کوئست' : 'ذخیرهٔ کوئست جدید'}
        onPress={handleSave}
      />
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
