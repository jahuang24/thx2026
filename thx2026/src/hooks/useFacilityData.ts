import { useCallback, useEffect, useState } from 'react';
import { beds as seedBeds, rooms as seedRooms } from '../data/mock';
import { realtimeBus } from '../services/realtime';
import { fetchBeds, fetchRooms, type RoomRecord } from '../services/facilityApi';
import type { Bed } from '../types';

export function useFacilityData() {
  const [rooms, setRooms] = useState<RoomRecord[]>(seedRooms);
  const [beds, setBeds] = useState<Bed[]>(seedBeds);
  const [loading, setLoading] = useState(true);

  const refreshRooms = useCallback(async () => {
    const next = await fetchRooms();
    if (next.length > 0) setRooms(next);
  }, []);

  const refreshBeds = useCallback(async () => {
    const next = await fetchBeds();
    if (next.length > 0) setBeds(next);
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([refreshRooms(), refreshBeds()]);
    setLoading(false);
  }, [refreshBeds, refreshRooms]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    const unsubRooms = realtimeBus.on('roomsUpdated', () => {
      void refreshRooms();
    });
    const unsubBeds = realtimeBus.on('bedsUpdated', () => {
      void refreshBeds();
    });
    return () => {
      unsubRooms();
      unsubBeds();
    };
  }, [refreshBeds, refreshRooms]);

  return { rooms, beds, loading, refreshRooms, refreshBeds, refreshAll };
}
