"use client";

import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  PDFDownloadLink,
} from "@react-pdf/renderer";

type ConcernStatsPoint = {
  month: string;
  total: number;
  needsAction: number;
  ongoing: number;
  resolved: number;
};

interface BarangayConcernsPDFProps {
  concernData: ConcernStatsPoint[];
  barangayName?: string;
  viewMode?: string;
  selectedYear?: number;
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    backgroundColor: "#ffffff",
    fontFamily: "Helvetica",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    borderBottom: "2px solid #3b82f6",
    paddingBottom: 15,
  },
  logo: {
    width: 50,
    height: 50,
    marginRight: 15,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 3,
  },
  dateGenerated: {
    fontSize: 10,
    color: "#9ca3af",
    marginTop: 5,
  },
  section: {
    marginTop: 20,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2563eb",
    marginBottom: 10,
    borderBottom: "1px solid #d1d5db",
    paddingBottom: 5,
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 10,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    border: "1px solid #e5e7eb",
  },
  statCardNeedsAction: {
    backgroundColor: "#fef3c7",
    borderColor: "#f59e0b",
  },
  statCardOngoing: {
    backgroundColor: "#dbeafe",
    borderColor: "#3b82f6",
  },
  statCardResolved: {
    backgroundColor: "#d1fae5",
    borderColor: "#10b981",
  },
  statCardTotal: {
    backgroundColor: "#f3f4f6",
    borderColor: "#6b7280",
  },
  statLabel: {
    fontSize: 9,
    color: "#6b7280",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1f2937",
  },
  table: {
    width: "100%",
    marginTop: 10,
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "1px solid #e5e7eb",
    paddingVertical: 8,
    paddingHorizontal: 5,
  },
  tableHeader: {
    backgroundColor: "#f3f4f6",
    fontWeight: "bold",
    borderBottom: "2px solid #d1d5db",
  },
  tableCell: {
    flex: 1,
    fontSize: 10,
    color: "#374151",
  },
  tableCellBold: {
    flex: 1,
    fontSize: 10,
    fontWeight: "bold",
    color: "#1f2937",
  },
  summary: {
    marginTop: 20,
    padding: 15,
    backgroundColor: "#eff6ff",
    borderRadius: 8,
    border: "1px solid #93c5fd",
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1e40af",
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  summaryLabel: {
    fontSize: 11,
    color: "#1d4ed8",
  },
  summaryValue: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#1e3a8a",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    borderTop: "1px solid #e5e7eb",
    paddingTop: 10,
    fontSize: 9,
    color: "#9ca3af",
    textAlign: "center",
  },
  statusBadge: {
    fontSize: 9,
    padding: "3px 6px",
    borderRadius: 4,
  },
  statusHigh: {
    backgroundColor: "#fee2e2",
    color: "#991b1b",
  },
  statusMedium: {
    backgroundColor: "#fef3c7",
    color: "#92400e",
  },
  statusGood: {
    backgroundColor: "#d1fae5",
    color: "#065f46",
  },
});

// PDF Document Component
export const BarangayConcernsDocument = ({
  concernData,
  barangayName,
  viewMode,
  selectedYear,
}: BarangayConcernsPDFProps) => {
  const totalConcerns = concernData.reduce((sum, item) => sum + item.total, 0);
  const totalNeedsAction = concernData.reduce(
    (sum, item) => sum + item.needsAction,
    0,
  );
  const totalOngoing = concernData.reduce((sum, item) => sum + item.ongoing, 0);
  const totalResolved = concernData.reduce(
    (sum, item) => sum + item.resolved,
    0,
  );
  const resolutionRate =
    totalConcerns > 0
      ? ((totalResolved / totalConcerns) * 100).toFixed(1)
      : "0";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Image src="/logo.png" style={styles.logo} />
          <View style={styles.headerText}>
            <Text style={styles.title}>Barangay Concerns Report</Text>
            <Text style={styles.subtitle}>
              City of Tagbilaran - Community Incident Tracking
            </Text>
            {barangayName && (
              <Text style={styles.subtitle}>Barangay: {barangayName}</Text>
            )}
            {viewMode === "yearly" && selectedYear && (
              <Text style={styles.subtitle}>Year: {selectedYear}</Text>
            )}
            <Text style={styles.dateGenerated}>
              Generated:{" "}
              {new Date().toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>
        </View>

        {/* Summary Stats */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, styles.statCardTotal]}>
            <Text style={styles.statLabel}>Total Concerns</Text>
            <Text style={styles.statValue}>{totalConcerns}</Text>
          </View>
          <View style={[styles.statCard, styles.statCardNeedsAction]}>
            <Text style={styles.statLabel}>Needs Action</Text>
            <Text style={styles.statValue}>{totalNeedsAction}</Text>
          </View>
          <View style={[styles.statCard, styles.statCardOngoing]}>
            <Text style={styles.statLabel}>Ongoing</Text>
            <Text style={styles.statValue}>{totalOngoing}</Text>
          </View>
          <View style={[styles.statCard, styles.statCardResolved]}>
            <Text style={styles.statLabel}>Resolved</Text>
            <Text style={styles.statValue}>{totalResolved}</Text>
          </View>
        </View>

        {/* Summary Information */}
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>Performance Metrics</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Resolution Rate:</Text>
            <Text style={styles.summaryValue}>{resolutionRate}%</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>
              Pending (Needs Action + Ongoing):
            </Text>
            <Text style={styles.summaryValue}>
              {totalNeedsAction + totalOngoing} concerns
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Average per Month:</Text>
            <Text style={styles.summaryValue}>
              {concernData.length > 0
                ? (totalConcerns / concernData.length).toFixed(1)
                : "0"}{" "}
              concerns
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Reporting Period:</Text>
            <Text style={styles.summaryValue}>
              {viewMode || "Monthly"} View
            </Text>
          </View>
        </View>

        {/* Detailed Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Monthly Breakdown</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={styles.tableCellBold}>Month</Text>
              <Text style={styles.tableCellBold}>Total</Text>
              <Text style={styles.tableCellBold}>Needs Action</Text>
              <Text style={styles.tableCellBold}>Ongoing</Text>
              <Text style={styles.tableCellBold}>Resolved</Text>
              <Text style={styles.tableCellBold}>Status</Text>
            </View>
            {concernData.map((item, index) => {
              const monthResolutionRate =
                item.total > 0
                  ? ((item.resolved / item.total) * 100).toFixed(0)
                  : "0";
              return (
                <View key={index} style={styles.tableRow}>
                  <Text style={styles.tableCell}>{item.month}</Text>
                  <Text style={styles.tableCell}>{item.total}</Text>
                  <Text style={styles.tableCell}>{item.needsAction}</Text>
                  <Text style={styles.tableCell}>{item.ongoing}</Text>
                  <Text style={styles.tableCell}>{item.resolved}</Text>
                  <Text style={styles.tableCell}>
                    {Number(monthResolutionRate) >= 70
                      ? "Good"
                      : Number(monthResolutionRate) >= 40
                        ? "Fair"
                        : "Needs Attention"}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Status Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status Distribution</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={styles.tableCellBold}>Status Category</Text>
              <Text style={styles.tableCellBold}>Count</Text>
              <Text style={styles.tableCellBold}>Percentage</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>Needs Action</Text>
              <Text style={styles.tableCell}>{totalNeedsAction}</Text>
              <Text style={styles.tableCell}>
                {totalConcerns > 0
                  ? ((totalNeedsAction / totalConcerns) * 100).toFixed(1)
                  : "0"}
                %
              </Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>Ongoing</Text>
              <Text style={styles.tableCell}>{totalOngoing}</Text>
              <Text style={styles.tableCell}>
                {totalConcerns > 0
                  ? ((totalOngoing / totalConcerns) * 100).toFixed(1)
                  : "0"}
                %
              </Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>Resolved</Text>
              <Text style={styles.tableCell}>{totalResolved}</Text>
              <Text style={styles.tableCell}>
                {totalConcerns > 0
                  ? ((totalResolved / totalConcerns) * 100).toFixed(1)
                  : "0"}
                %
              </Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>
            Track the Truck - Community Concerns System | City of Tagbilaran
          </Text>
          <Text>This is an official system-generated report</Text>
        </View>
      </Page>
    </Document>
  );
};

// Download Button Component
export const BarangayConcernsPDFDownload = ({
  concernData,
  barangayName,
  viewMode,
  selectedYear,
}: BarangayConcernsPDFProps) => {
  const fileName = `Barangay_Concerns_Report_${new Date().toISOString().split("T")[0]}.pdf`;

  return (
    <PDFDownloadLink
      document={
        <BarangayConcernsDocument
          concernData={concernData}
          barangayName={barangayName}
          viewMode={viewMode}
          selectedYear={selectedYear}
        />
      }
      fileName={fileName}
      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200 shadow-lg hover:shadow-xl"
    >
      {({ loading }) =>
        loading ? (
          <span>⏳ Preparing PDF...</span>
        ) : (
          <>
            <span>📄</span>
            <span>Download PDF Report</span>
          </>
        )
      }
    </PDFDownloadLink>
  );
};
