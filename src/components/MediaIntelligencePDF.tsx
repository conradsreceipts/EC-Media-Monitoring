import React from 'react';
import { Document, Page, Text, View, StyleSheet, Link } from '@react-pdf/renderer';
import { ReportData, PDFArticleCluster } from '../types';

// Use built-in fonts for maximum reliability
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    backgroundColor: '#FFFFFF',
  },
  header: {
    marginBottom: 30,
    borderBottom: 2,
    borderBottomColor: '#004A99',
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#004A99',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  coverPage: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    textAlign: 'center',
  },
  coverTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#004A99',
    marginBottom: 10,
  },
  coverSubtitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#004A99',
    marginTop: 20,
    marginBottom: 10,
    borderBottom: 1,
    borderBottomColor: '#EEEEEE',
    paddingBottom: 5,
  },
  tocItem: {
    fontSize: 12,
    marginBottom: 8,
    color: '#333333',
    textDecoration: 'none',
  },
  articleCard: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderLeft: 4,
    borderLeftColor: '#004A99',
  },
  articleTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#111827',
  },
  articleMeta: {
    fontSize: 9,
    color: '#6B7280',
    marginBottom: 10,
    flexDirection: 'row',
    gap: 10,
  },
  articleSummary: {
    fontSize: 10,
    lineHeight: 1.5,
    color: '#374151',
    marginBottom: 10,
  },
  badgeContainer: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 5,
  },
  badge: {
    fontSize: 8,
    padding: '2 6',
    borderRadius: 4,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  riskHigh: { backgroundColor: '#FEE2E2', color: '#991B1B' },
  riskMedium: { backgroundColor: '#FEF3C7', color: '#92400E' },
  riskLow: { backgroundColor: '#DCFCE7', color: '#166534' },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    textAlign: 'center',
    color: '#999999',
    borderTop: 1,
    borderTopColor: '#EEEEEE',
    paddingTop: 10,
  },
  link: {
    color: '#004A99',
    textDecoration: 'underline',
    fontSize: 9,
  }
});

interface MediaIntelligencePDFProps {
  data: ReportData;
  dateRange: string;
}

export const MediaIntelligencePDF: React.FC<MediaIntelligencePDFProps> = ({ data, dateRange }) => {
  const categories = Object.keys(data.clusters);

  return (
    <Document title={`EC Media Intelligence Report - ${dateRange}`}>
      {/* Cover Page */}
      <Page size="A4" style={styles.page}>
        <View style={styles.coverPage}>
          <Text style={styles.coverSubtitle}>OFFICE OF THE PREMIER</Text>
          <Text style={styles.coverTitle}>Media Intelligence Report</Text>
          <Text style={{ fontSize: 12, color: '#666666', marginBottom: 20 }}>
            Eastern Cape Provincial Government
          </Text>
          <View style={{ width: 100, height: 2, backgroundColor: '#004A99', marginBottom: 20 }} />
          <Text style={{ fontSize: 14, fontWeight: 'bold' }}>{dateRange.toUpperCase()}</Text>
          <Text style={{ fontSize: 10, color: '#999999', marginTop: 10 }}>
            Generated on {new Date().toLocaleString()}
          </Text>
        </View>
        <Text style={styles.footer}>Confidential - For Internal Use Only</Text>
      </Page>

      {/* Table of Contents */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Table of Contents</Text>
          <Text style={styles.subtitle}>Intelligence Summary by Category</Text>
        </View>
        <View style={{ marginTop: 20 }}>
          {categories.map((cat) => (
            <Link key={cat} src={`#${cat}`} style={styles.tocItem}>
              • {cat} ({data.clusters[cat].length} Intelligence Clusters)
            </Link>
          ))}
        </View>
        <Text style={styles.footer}>Page 2 | EC Media Intelligence Report</Text>
      </Page>

      {/* Detailed Sections */}
      {categories.map((cat, catIdx) => (
        <Page key={cat} size="A4" style={styles.page} wrap>
          <View id={cat} style={styles.header}>
            <Text style={styles.title}>{cat}</Text>
            <Text style={styles.subtitle}>Section {catIdx + 1} | Detailed Analysis</Text>
          </View>

          {data.clusters[cat].map((cluster, clusterIdx) => (
            <View key={clusterIdx} style={styles.articleCard} wrap={false}>
              <Text style={styles.articleTitle}>{cluster.articles[0].article_title}</Text>
              
              <View style={styles.articleMeta}>
                <Text>Source: {cluster.articles[0].source_name}</Text>
                <Text>Date: {cluster.articles[0].publication_date}</Text>
                <Text>Location: {cluster.articles[0].municipality_or_district || 'Provincial'}</Text>
              </View>

              <Text style={styles.articleSummary}>
                {cluster.summary || cluster.articles[0].summary_1_paragraph}
              </Text>

              <View style={styles.badgeContainer}>
                <View style={[styles.badge, 
                  (cluster.articles[0].reputational_risk === 'High' || cluster.articles[0].reputational_risk === 'Critical') ? styles.riskHigh : 
                  cluster.articles[0].reputational_risk === 'Moderate' ? styles.riskMedium : styles.riskLow
                ]}>
                  <Text>{cluster.articles[0].reputational_risk} Risk</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: '#F3F4F6', color: '#374151' }]}>
                  <Text>Tone: {cluster.articles[0].tone_classification}</Text>
                </View>
                {cluster.articles.length > 1 && (
                  <View style={[styles.badge, { backgroundColor: '#DBEAFE', color: '#1E40AF' }]}>
                    <Text>+{cluster.articles.length - 1} Syndicated Sources</Text>
                  </View>
                )}
              </View>

              <View style={{ marginTop: 10 }}>
                <Link src={cluster.articles[0].article_url} style={styles.link}>
                  View Original Source Article
                </Link>
              </View>
            </View>
          ))}
          
          <Text style={styles.footer}>
            {cat} | EC Media Intelligence Report
          </Text>
        </Page>
      ))}
    </Document>
  );
};
