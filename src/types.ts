import { Type } from "@google/genai";

export interface MonitoringConfig {
  dateRange: '24h' | '72h' | '7d' | '14d' | '21d' | '28d' | '3m' | 'custom';
  customDateRange?: { start: string; end: string };
  provincial: {
    executive: {
      enabled: boolean;
      subSections: { [key: string]: boolean };
    };
    delivery: {
      enabled: boolean;
      subSections: { [key: string]: boolean };
    };
  };
  local: {
    executive: {
      enabled: boolean;
      subSections: { [key: string]: boolean };
    };
    delivery: {
      enabled: boolean;
      subSections: { [key: string]: boolean };
    };
  };
  includePoliticalParties: boolean;
}

export interface SortConfig {
  field: 'date' | 'relevance' | 'risk';
  direction: 'asc' | 'desc';
}

export interface Article {
  article_title: string;
  article_url: string;
  source_name: string;
  source_type: string;
  publication_date: string;
  author: string;
  governance_level: string;
  sphere_of_government: string;
  primary_entity: string;
  secondary_entities: string[];
  matched_keywords: string[];
  fuzzy_matched_terms: string[];
  topic_categories: string[];
  dominant_topic: string;
  relevance_classification: 'Highly Relevant' | 'Relevant' | 'Possibly Relevant' | 'Not Relevant';
  confidence_score: number;
  confidence_reason: string;
  tone_classification: 'Positive' | 'Neutral' | 'Negative' | 'Mixed' | 'Unclear';
  tone_reason: string;
  reputational_risk: 'Critical' | 'High' | 'Moderate' | 'Low' | 'None';
  risk_reason: string;
  municipality_or_district: string;
  department_or_office: string;
  person_or_officials_mentioned: string[];
  summary_1_sentence: string;
  summary_1_paragraph: string;
  recommended_action: string;
  action_reason: string;
  duplicate_cluster_id: string;
  is_duplicate_or_syndicated: boolean;
  body_verification_used: boolean;
  body_verification_reason: string;
  escalation_flag: boolean;
  response_needed: boolean;
  misinformation_or_fact_check_flag: boolean;
  url_verification_status: 'Verified' | 'Unverified' | 'Potentially Hallucinated';
  grounding_source: string;
  watchlist_flags: string[];
  geographic_tags: string[];
  user_tags?: string[];
}

export interface MonitoringSummary {
  total_articles_scanned: number;
  total_relevant_articles: number;
  total_highly_relevant: number;
  positive: number;
  neutral: number;
  negative: number;
  mixed: number;
  high_risk: number;
  critical_risk: number;
  response_needed: number;
  top_topics: string[];
  top_sources: string[];
  top_entities: string[];
  top_municipalities_or_districts: string[];
}

export interface PDFArticleCluster {
  articles: Article[];
  summary?: string;
}

export interface ReportData {
  clusters: { [category: string]: PDFArticleCluster[] };
}

export interface MonitoringReport {
  query_period: string;
  generated_at: string;
  summary: MonitoringSummary;
  articles: Article[];
  verification_checklist: {
    domain: string;
    status: 'Checked - Articles Found' | 'Checked - No Relevant Articles' | 'Access Restricted' | 'Zero Results';
    findings_summary: string;
  }[];
}

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export const ARTICLE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    article_title: { type: Type.STRING },
    article_url: { type: Type.STRING },
    source_name: { type: Type.STRING },
    source_type: { type: Type.STRING },
    publication_date: { type: Type.STRING },
    author: { type: Type.STRING },
    governance_level: { type: Type.STRING },
    sphere_of_government: { type: Type.STRING },
    primary_entity: { type: Type.STRING },
    secondary_entities: { type: Type.ARRAY, items: { type: Type.STRING } },
    matched_keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
    fuzzy_matched_terms: { type: Type.ARRAY, items: { type: Type.STRING } },
    topic_categories: { type: Type.ARRAY, items: { type: Type.STRING } },
    dominant_topic: { type: Type.STRING },
    relevance_classification: { type: Type.STRING, enum: ['Highly Relevant', 'Relevant', 'Possibly Relevant', 'Not Relevant'] },
    confidence_score: { type: Type.NUMBER },
    confidence_reason: { type: Type.STRING },
    tone_classification: { type: Type.STRING, enum: ['Positive', 'Neutral', 'Negative', 'Mixed', 'Unclear'] },
    tone_reason: { type: Type.STRING },
    reputational_risk: { type: Type.STRING, enum: ['Critical', 'High', 'Moderate', 'Low', 'None'] },
    risk_reason: { type: Type.STRING },
    municipality_or_district: { type: Type.STRING },
    department_or_office: { type: Type.STRING },
    person_or_officials_mentioned: { type: Type.ARRAY, items: { type: Type.STRING } },
    summary_1_sentence: { type: Type.STRING },
    summary_1_paragraph: { type: Type.STRING },
    recommended_action: { type: Type.STRING },
    action_reason: { type: Type.STRING },
    duplicate_cluster_id: { type: Type.STRING },
    is_duplicate_or_syndicated: { type: Type.BOOLEAN },
    body_verification_used: { type: Type.BOOLEAN },
    body_verification_reason: { type: Type.STRING },
    escalation_flag: { type: Type.BOOLEAN },
    response_needed: { type: Type.BOOLEAN },
    misinformation_or_fact_check_flag: { type: Type.BOOLEAN },
    url_verification_status: { type: Type.STRING, enum: ['Verified', 'Unverified', 'Potentially Hallucinated'] },
    grounding_source: { type: Type.STRING },
    watchlist_flags: { type: Type.ARRAY, items: { type: Type.STRING } },
    geographic_tags: { type: Type.ARRAY, items: { type: Type.STRING } },
    user_tags: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: [
    'article_title', 'article_url', 'source_name', 'relevance_classification', 
    'confidence_score', 'tone_classification', 'reputational_risk', 
    'summary_1_sentence', 'summary_1_paragraph', 'url_verification_status'
  ]
};

export const REPORT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    query_period: { type: Type.STRING },
    generated_at: { type: Type.STRING },
    summary: {
      type: Type.OBJECT,
      properties: {
        total_articles_scanned: { type: Type.NUMBER },
        total_relevant_articles: { type: Type.NUMBER },
        total_highly_relevant: { type: Type.NUMBER },
        positive: { type: Type.NUMBER },
        neutral: { type: Type.NUMBER },
        negative: { type: Type.NUMBER },
        mixed: { type: Type.NUMBER },
        high_risk: { type: Type.NUMBER },
        critical_risk: { type: Type.NUMBER },
        response_needed: { type: Type.NUMBER },
        top_topics: { type: Type.ARRAY, items: { type: Type.STRING } },
        top_sources: { type: Type.ARRAY, items: { type: Type.STRING } },
        top_entities: { type: Type.ARRAY, items: { type: Type.STRING } },
        top_municipalities_or_districts: { type: Type.ARRAY, items: { type: Type.STRING } },
      }
    },
    articles: {
      type: Type.ARRAY,
      items: ARTICLE_SCHEMA
    },
    verification_checklist: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          domain: { type: Type.STRING },
          status: { type: Type.STRING, enum: ['Checked - Articles Found', 'Checked - No Relevant Articles', 'Access Restricted', 'Zero Results'] },
          findings_summary: { type: Type.STRING }
        }
      }
    }
  }
};
