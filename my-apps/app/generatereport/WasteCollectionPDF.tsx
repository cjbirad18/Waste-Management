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

type WasteCollectionPoint = { month: string; tons: number };
type PerformancePoint = { month: string; efficiency: number };

interface WasteCollectionPDFProps {
  wasteData: WasteCollectionPoint[];
  performanceData: PerformancePoint[];
  timePeriod: string;
  barangayName?: string;
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
    borderBottom: "2px solid #10b981",
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
    color: "#059669",
    marginBottom: 10,
    borderBottom: "1px solid #d1d5db",
    paddingBottom: 5,
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
    backgroundColor: "#f0fdf4",
    borderRadius: 8,
    border: "1px solid #86efac",
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#065f46",
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  summaryLabel: {
    fontSize: 11,
    color: "#047857",
  },
  summaryValue: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#065f46",
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
  chartPlaceholder: {
    marginTop: 10,
    padding: 20,
    backgroundColor: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    textAlign: "center",
  },
  chartText: {
    fontSize: 10,
    color: "#6b7280",
  },
});

// PDF Document Component
export const WasteCollectionDocument = ({
  wasteData,
  performanceData,
  timePeriod,
  barangayName,
}: WasteCollectionPDFProps) => {
  const totalWaste = wasteData.reduce((sum, item) => sum + item.tons, 0);
  const averageWaste = wasteData.length ? totalWaste / wasteData.length : 0;
  const avgEfficiency = performanceData.length
    ? performanceData.reduce((sum, item) => sum + item.efficiency, 0) /
      performanceData.length
    : 0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Image src="/logo.png" style={styles.logo} />
          <View style={styles.headerText}>
            <Text style={styles.title}>Waste Collection Report</Text>
            <Text style={styles.subtitle}>
              City of Tagbilaran - Track the Truck System
            </Text>
            {barangayName && (
              <Text style={styles.subtitle}>Barangay: {barangayName}</Text>
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

        {/* Summary Section */}
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>Executive Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Reporting Period:</Text>
            <Text style={styles.summaryValue}>
              {timePeriod.charAt(0).toUpperCase() + timePeriod.slice(1)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Waste Collected:</Text>
            <Text style={styles.summaryValue}>
              {totalWaste.toFixed(2)} tons
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Average per Period:</Text>
            <Text style={styles.summaryValue}>
              {averageWaste.toFixed(2)} tons
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Average Efficiency:</Text>
            <Text style={styles.summaryValue}>{avgEfficiency.toFixed(1)}%</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Number of Collections:</Text>
            <Text style={styles.summaryValue}>{wasteData.length}</Text>
          </View>
        </View>

        {/* Waste Collection Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Waste Collection Data</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={styles.tableCellBold}>Period</Text>
              <Text style={styles.tableCellBold}>Waste Collected (tons)</Text>
              <Text style={styles.tableCellBold}>Status</Text>
            </View>
            {wasteData.map((item, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={styles.tableCell}>{item.month}</Text>
                <Text style={styles.tableCell}>{item.tons.toFixed(2)}</Text>
                <Text style={styles.tableCell}>
                  {item.tons > averageWaste ? "Above Avg" : "Below Avg"}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Performance Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Collection Efficiency</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={styles.tableCellBold}>Period</Text>
              <Text style={styles.tableCellBold}>Efficiency (%)</Text>
              <Text style={styles.tableCellBold}>Performance</Text>
            </View>
            {performanceData.map((item, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={styles.tableCell}>{item.month}</Text>
                <Text style={styles.tableCell}>
                  {item.efficiency.toFixed(1)}%
                </Text>
                <Text style={styles.tableCell}>
                  {item.efficiency >= 80
                    ? "Excellent"
                    : item.efficiency >= 60
                      ? "Good"
                      : "Needs Improvement"}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>
            Track the Truck - Waste Management System | City of Tagbilaran
          </Text>
          <Text>This is an official system-generated report</Text>
        </View>
      </Page>
    </Document>
  );
};

// Download Button Component
export const WasteCollectionPDFDownload = ({
  wasteData,
  performanceData,
  timePeriod,
  barangayName,
}: WasteCollectionPDFProps) => {
  const fileName = `Waste_Collection_Report_${new Date().toISOString().split("T")[0]}.pdf`;

  return (
    <PDFDownloadLink
      document={
        <WasteCollectionDocument
          wasteData={wasteData}
          performanceData={performanceData}
          timePeriod={timePeriod}
          barangayName={barangayName}
        />
      }
      fileName={fileName}
      className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors duration-200 shadow-lg hover:shadow-xl"
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
