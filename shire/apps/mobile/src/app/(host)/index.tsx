import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type GlassSurfaceProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

function GlassSurface({ children, style }: GlassSurfaceProps) {
  return <View style={[style, styles.blurFallback]}>{children}</View>;
}

export default function FloorPlanScreen() {
  const waitlistData = [
    { name: 'Sarah S.', size: 4, wait: '15m', status: 'Waiting' },
    { name: 'David M.', size: 6, wait: '20m', status: 'Waiting' },
    { name: 'Emily L.', size: 2, wait: 'Now', status: 'Next' },
    { name: 'John K.', size: 5, wait: '30m', status: 'Waiting' },
    { name: 'Anna P.', size: 8, wait: '45m', status: 'Waiting' },
    { name: 'Chris T.', size: 2, wait: '1h', status: 'Waiting' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Background to give liquid glass effect depth */}
      <View style={styles.ambientBackground} />

      <View style={styles.splitLayout}>
        {/* Left Sidebar - Waitlist */}
        <GlassSurface style={styles.waitlistSidebar}>
          <View style={styles.sidebarHeader}>
            <Text style={styles.sidebarTitle}>Waitlist (14 parties)</Text>
            <TouchableOpacity><Ionicons name="ellipsis-horizontal" size={20} color="#666" /></TouchableOpacity>
          </View>
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {waitlistData.map((party, index) => (
              <View key={index} style={styles.waitlistCard}>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName}>{index + 1}. {party.name}</Text>
                  <Text style={styles.cardDetails}>{party.wait} • Party of {party.size}</Text>
                </View>
                <View style={styles.cardStatusContainer}>
                  <Text style={[styles.cardStatus, party.status === 'Next' && styles.statusNext]}>{party.status}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </GlassSurface>

        {/* Right Area - Floor Plan */}
        <View style={styles.mainArea}>
          {/* Top Liquid Glass Filter Pills */}
          <View style={styles.filterPillsContainer}>
            {['Main Dining', 'Patio / Outside', 'Booths', 'Bar'].map((filter, i) => (
              <TouchableOpacity key={i} activeOpacity={0.8}>
                <GlassSurface style={[styles.pill, i === 0 && styles.pillActive]}>
                  <Text style={[styles.pillText, i === 0 && styles.pillTextActive]}>{filter}</Text>
                </GlassSurface>
              </TouchableOpacity>
            ))}
          </View>

          {/* High-Density Map Area */}
          <View style={styles.mapContainer}>
            <View style={styles.roomOutline}>
              <Text style={styles.roomLabel}>MAIN DINING A</Text>

              <View style={styles.tableRow}>
                <View style={[styles.tableCircle, styles.tableOccupied]}><Text style={styles.tableId}>1</Text><Text style={styles.tableSize}>4p</Text></View>
                <View style={[styles.tableCircle, styles.tableAvailable]}><Text style={styles.tableId}>2</Text><Text style={styles.tableSize}>2p</Text></View>
                <View style={[styles.tableSquare, styles.tableReserved]}><Text style={styles.tableId}>3</Text><Text style={styles.tableSize}>4p</Text></View>
                <View style={[styles.tableCircle, styles.tableDirty]}><Text style={styles.tableId}>4</Text><Text style={styles.tableSize}>6p</Text></View>
              </View>

              <View style={styles.tableRow}>
                <View style={[styles.tableSquare, styles.tableAvailable]}><Text style={styles.tableId}>5</Text><Text style={styles.tableSize}>2p</Text></View>
                <View style={[styles.tableSquare, styles.tableOccupied]}><Text style={styles.tableId}>6</Text><Text style={styles.tableSize}>4p</Text></View>
                <View style={[styles.tableCircle, styles.tableAvailable]}><Text style={styles.tableId}>7</Text><Text style={styles.tableSize}>2p</Text></View>
                <View style={[styles.tableCircle, styles.tableOccupied]}><Text style={styles.tableId}>8</Text><Text style={styles.tableSize}>4p</Text></View>
              </View>

              <View style={styles.tableRow}>
                <View style={[styles.tableHorizontal, styles.tableOccupied]}><Text style={styles.tableId}>9</Text><Text style={styles.tableSize}>8p</Text></View>
                <View style={[styles.tableCircle, styles.tableReserved]}><Text style={styles.tableId}>10</Text><Text style={styles.tableSize}>2p</Text></View>
                <View style={[styles.tableCircle, styles.tableAvailable]}><Text style={styles.tableId}>11</Text><Text style={styles.tableSize}>4p</Text></View>
              </View>
            </View>

            <View style={[styles.roomOutline, styles.roomPatio]}>
              <Text style={styles.roomLabel}>PATIO</Text>
              <View style={styles.tableRow}>
                <View style={[styles.tableSquare, styles.tableAvailable]}><Text style={styles.tableId}>P1</Text></View>
                <View style={[styles.tableSquare, styles.tableAvailable]}><Text style={styles.tableId}>P2</Text></View>
              </View>
              <View style={styles.tableRow}>
                <View style={[styles.tableSquare, styles.tableOccupied]}><Text style={styles.tableId}>P3</Text></View>
                <View style={[styles.tableSquare, styles.tableAvailable]}><Text style={styles.tableId}>P4</Text></View>
              </View>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F5F0', // Cream warm background
  },
  ambientBackground: {
    position: 'absolute',
    top: -100,
    left: -100,
    right: -100,
    bottom: -100,
    backgroundColor: '#F7F5F0',
  },
  splitLayout: {
    flex: 1,
    flexDirection: 'row',
    padding: 16,
    gap: 16,
  },
  waitlistSidebar: {
    width: 320,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.4)', // The actual tint comes from the BlurView, but adding a base alpha helps
  },
  blurFallback: {
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
  },
  sidebarHeader: {
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  sidebarTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    letterSpacing: -0.5,
  },
  scrollView: {
    padding: 12,
  },
  waitlistCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  cardDetails: {
    fontSize: 13,
    color: '#666',
  },
  cardStatusContainer: {
    paddingLeft: 12,
  },
  cardStatus: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E88B12', // Waiting orange
  },
  statusNext: {
    color: '#34C759', // Next active green
  },
  mainArea: {
    flex: 1,
    flexDirection: 'column',
  },
  filterPillsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
  },
  pill: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },
  pillActive: {
    backgroundColor: 'rgba(255,255,255, 1)', // More solid when active
    borderColor: '#E8DED1',
  },
  pillText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  pillTextActive: {
    color: '#1a1a1a',
  },
  mapContainer: {
    flex: 1,
    flexDirection: 'row',
    gap: 16,
  },
  roomOutline: {
    flex: 1,
    borderWidth: 2,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    borderRadius: 24,
    padding: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  roomPatio: {
    flex: 0.4,
    backgroundColor: 'rgba(230, 225, 215, 0.3)', // Slightly darker for patio
  },
  roomLabel: {
    position: 'absolute',
    top: -12,
    left: 24,
    backgroundColor: '#F7F5F0',
    paddingHorizontal: 8,
    fontSize: 12,
    fontWeight: '700',
    color: '#8A847A',
    letterSpacing: 1,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 32,
    marginTop: 16,
  },
  tableBase: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  tableCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  tableSquare: {
    width: 64,
    height: 64,
    borderRadius: 16,
  },
  tableHorizontal: {
    width: 140,
    height: 64,
    borderRadius: 16,
  },
  tableId: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  tableSize: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  /* Table Statuses mapped to subtle liquid aesthetics */
  tableAvailable: {
    borderColor: '#34C759', // Green
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  tableOccupied: {
    borderColor: '#007AFF', // Blue
    backgroundColor: 'rgba(240, 248, 255, 0.9)',
  },
  tableDirty: {
    borderColor: '#FF3B30', // Red
    backgroundColor: 'rgba(255, 240, 240, 0.9)',
  },
  tableReserved: {
    borderColor: '#FF9500', // Orange
    backgroundColor: 'rgba(255, 250, 240, 0.9)',
  }
});
