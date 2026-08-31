/**
 * Complete Master UPSC CSE Prelims Syllabus Hierarchy.
 * Canonical 3-Level Taxonomy (Subjects -> Topics -> Subtopics)
 * Pre-bundled on the frontend for instant, zero-latency search and filtering.
 */

export interface SyllabusSubtopic {
  name: string;
}

export interface SyllabusTopic {
  name: string;
  subtopics: string[];
}

export interface SyllabusSubject {
  name: string;
  topics: SyllabusTopic[];
}

export const MASTER_SYLLABUS_HIERARCHY: Record<string, Record<string, string[]>> = {
  'History': {
    'Ancient History': [
      'Pre Historic Times',
      'Indus Valley Civilization',
      'Rig Vedic Period',
      'Later Vedic Period',
      'Jainism',
      'Buddhism',
      'Mahajanapadas Period',
      'Mauryan Empire',
      'Post-Mauryan India',
      'Gupta Period',
      'Harshavardhana Period',
      'Sangam Period (South Indian Dynasties)',
    ],
    'Medieval India': [
      'Major Dynasties (750-1200) of Early Medieval India',
      'Cholas and Other South Indian Kingdoms',
      'Early Muslim Invasions',
      'The Delhi Sultanate (1206-1526 AD)',
      'Struggle for Empire in North India (Afghans, Rajputs and Mughals)',
      'The Establishment of the North Indian Empire',
      'Consolidation and Expansion of the Empire - Akbar',
      'State and Government under Akbar',
      'Akbar\'s Religious Views',
      'The Deccan and the Mughals (Up to 1657)',
      'Foreign Policy of the Mughals',
      'India in the First Half of the Seventeenth Century',
      'Climax and Crisis of the Mughal Empire: The Marathas and the Deccan',
      'The Maratha and Other Indian States and Society in The 18th Century',
      'Vijayanagar Empire',
      'Regional States in the Medieval Period',
      'Northern India in the First Half of the Eighteenth Century',
      'Society-Structure and Growth',
      'Economic Life-Patterns and Prospects',
    ],
    'Modern History': [
      'The Advent of Europeans In India',
      'British Expansion in India',
      'Administration before 1857',
      'Economic Policies of The British',
      'Impact of British Administration',
      'The Revolt Of 1857',
      'Administrative Changes After 1857',
      'Development of Civil Services',
      'Development of Education',
      'Development of Press',
      'Socio-Religious Reforms',
      'Personalities',
      'Peasant, Tribal and Other Movements',
      'Revolutionary Nationalism',
      'Indian National Movement - I (1905-1918)',
      'Indian National Movement - II (1918-1929)',
      'Indian National Movement - III (1930-1947)',
      'Governor Generals During British India',
      'Constitutional Development in India',
    ],
  },
  'Indian Culture': {
    'Visual Arts': [
      'Architecture',
      'Sculptures',
      'Paintings',
      'Pottery Tradition',
      'Numismatics',
    ],
    'Performing Arts': [
      'Music in India',
      'Dances in India',
      'Sports in India',
      'Indian Theatre',
      'Indian Puppetry',
    ],
    'Religion, Language and Literature': [
      'Religions in-India',
      'Languages and Literature in India',
      'Philosophy in India',
      'Bhakti & Sufi Movement',
    ],
    'Miscellaneous Culture': [
      'Government Cultural Institutions in India',
      'UNESCO List of Cultural Heritage',
      'Protection and Promotion of Indian Culture',
      'Cultural Schemes and Awards',
      'Personalities Related to Culture',
      'Places of Cultural Interest',
      'The Calendar & Eras',
      'Science and Technology in Ancient India',
      'Recent Developments in Culture',
    ],
  },
  'Geography': {
    'General Geography': [
      'Universe',
      'Earth Evolution',
    ],
    'Geomorphology': [
      'Earth\'s Interior',
      'Geology and Rock system',
      'Geomorphic Processes',
      'Earthquakes and Volcanism',
      'Distribution of Continents & Oceans',
      'Landforms and their evolution',
      'Landforms across the world',
    ],
    'Oceanography': [
      'Hydrosphere',
      'Submarine Relief Features',
      'Temperature and Salinity',
      'Waves, Ocean Currents, Tides',
      'Marine Resources',
      'Ocean Deposits and Corals',
    ],
    'Climatology': [
      'Atmosphere',
      'Inversion of Temperature',
      'Insolation and Heat Budget',
      'Winds and Pressure belts',
      'Air Mass, Fronts, Cyclones and Jet Stream',
      'Precipitation',
      'Climatic Zones of the World',
    ],
    'Bio-Geography': [
      'Soil Characteristics',
      'Vegetation resources',
    ],
    'Human and Economic Geography of the World': [
      'Demography and Census',
      'Human Development',
      'Economic activities',
      'Transport and Communication',
      'International Trade',
      'Settlement',
    ],
    'Indian Geography': [
      'Physiography of India',
      'Drainage System',
      'Climate',
      'Soils in India',
      'Natural Vegetation',
      'Population',
      'Settlements and Urbanization',
      'Land Resource',
      'Mineral Resource',
      'Energy resources',
      'Agriculture Basic Terminologies',
      'Recent developments in agriculture field',
      'Productivity of Crops and conditions for growth',
      'Industry',
      'Transport',
      'Recent Development in Transport Sector',
      'Recent developments in Industrial Sector',
    ],
    'World Regional Geography': [
      'Continents Countries and Cities',
      'Location in NEWS',
    ],
  },
  'Ecology & Environment': {
    'Environmental Ecology': [
      'Origin of Life forms',
      'Basic Concepts of Ecology',
      'Ecosystem functions',
      'Population Ecology',
      'Adaptation of Species and Interactions',
      'Terrestrial ecosystems',
      'Aquatic ecosystem',
      'Nutrient Cycling',
    ],
    'Biodiversity': [
      'Basics of Biodiversity',
      'Animal and Plant Diversity',
      'Threats to biodiversity',
      'Biodiversity Conservation',
      'Estuaries',
      'Mangroves',
      'Coral Reef',
      'Wetlands',
    ],
    'Resource Degradation and Management': [
      'Land Resource',
      'Forest resource',
      'Soil Resource',
      'Water Pollution',
      'Energy Resources',
    ],
    'Environmental Pollution': [
      'Basics of Pollution',
      'Mining and pollution',
      'Air pollution',
      'Marine Pollution',
      'Noise Pollution',
      'Biological Pollution',
      'Radioactive Pollution',
      'Thermal Pollution',
      'Waste Management',
    ],
    'Climate Change': [
      'Climate Change Basics',
      'Climate Change Impact',
    ],
    'Environmental Governance': [
      'Acts and Policies',
      'Environment Impact Assessment (EIA)',
      'International Environmental Governance',
      'India and Climate Change',
      'Environment related Institutions in India',
      'Environmental schemes in India',
      'Appendix & Recent Developments',
    ],
  },
  'Indian Polity & Governance': {
    'Evolution of the Constitution': [
      'The Company Rule (1773-1858)',
      'The Crown Rule (1858-1947)',
      'Drafting and Sources of Indian Constitution',
    ],
    'Salient Features of Indian Constitution': [
      'Constitution and Types',
      'Types of Political System',
      'Types of Majorities as per the Indian Constitution',
      'Preamble and Values in the Constitution',
      'Amendment of The Constitution',
      'Doctrine and Terms',
      'Other Constitutional Dimensions',
    ],
    'Union & Its Territory': [
      'Article 1-4',
    ],
    'Citizenship': [
      'Constitutional Provisions',
      'Indian Diaspora',
    ],
    'Fundamental Rights': [
      'Evolution Objectives And Features',
      'Article 12 and Article 13',
      'Right to Equality',
      'Right to Freedom',
      'Right against Exploitation',
      'Right to Freedom of Religion',
      'Cultural and Educational Rights',
      'Right to Constitutional Remedies',
      'FR\'s other Dimensions',
    ],
    'Directive Principles of State Policy (DPSP)': [
      'Evolution, objectives, and features',
      'Socialistic Principles',
      'Gandhian Principles',
      'Liberal-Intellectual Principles',
      'Directive Principle Outside Part IV',
    ],
    'Fundamental Duties': [
      'Article 51A',
      'Recent developments',
    ],
    'System of Governance': [
      'Centre-State Relations',
      'Inter State Relation',
      'Special Provisions for some States',
      'Types of Emergencies',
    ],
    'Union Executive': [
      'President',
      'Vice President',
      'The Prime Minister',
      'Union Council of Minister',
    ],
    'Union Legislature': [
      'Organisation of Parliament',
      'Parliament, Lok Sabha and Rajya Sabha',
      'Legislative Procedure and Committees of Parliament',
    ],
    'State Legislature': [
      'Governor',
      'The Chief Minister and the CoM',
      'Legislative Assembly',
      'Legislative Council (Article 169)',
    ],
    'Local Government': [
      'Panchayati Raj',
      'Urban Local Government',
    ],
    'Union Territories and Special Areas': [
      'Union Territories',
      'Schedule and Tribal Areas',
    ],
    'The Judiciary': [
      'The Supreme Court',
      'The High Court Subordinate Courts & Lok Adalats',
    ],
    'Constitutional and Non Constitutional Bodies': [
      'Constitutional Bodies',
      'Non Constitutional',
    ],
    'Political Dynamics': [
      'Political Parties and Election',
      'Pressure Groups',
    ],
    'Governance': [
      'Governing Institutions in India',
      'Audit and other Transparency initiatives',
      'Role of SHG, NGOs, Civil Society',
      'Social Sector Bills',
      'Welfare Schemes',
    ],
    'International Relations': [
      'India\'s Foreign Policy',
      'South Asia',
      'Central Asia',
      'West Asia',
      'Asia - Pacific',
      'Africa',
      'Europe',
      'US-China',
      'Indian Ocean Region',
    ],
  },
  'Economy': {
    'Basic Concepts': [
      'Macroeconomic Concepts',
      'Microeconomic Concepts',
    ],
    'Economic Measurements': [
      'National Income Concepts and Methods of Calculation',
      'Inflation',
      'Economic Growth and Development',
    ],
    'Money and Banking': [
      'Money Function and Classification',
      'Financial Market and its Instruments',
      'Banking Structure in India',
    ],
    'Public Finance in India': [
      'Budgeting',
      'Fiscal Policy',
      'Centre State Distribution',
      'Tax Structure in India',
    ],
    'Planning': [
      'Meaning Objectives and History',
      'Planning Institutions',
      'Five Year Plans in India',
    ],
    'Open Economy': [
      'Foreign Trade Concepts',
      'Trade Policy and Agreements',
      'Exchange Rate',
      'International Organization',
      'Trade Agreements',
      'Recent Developments in External Sector',
    ],
    'Economic Sectors': [
      'Poverty',
      'Employment',
      'Government Schemes and Programs',
      'Committees',
    ],
  },
  'Science & Technology': {
    'Science and Technology in India': [
      'Policy Development of S&T in India',
      'Different Organization Institution and Various Department for the S&T',
    ],
    'Space': [
      'Space Research Programme, Orbits and Launch',
      'Satellites, Launch Vehicles and India Satellite Programmes',
      'Recent developments',
    ],
    'IT and Communication': [
      'Different Regulatory Bodies in India for ICT',
      'Computer Terminology and Fundamental',
      'Mobile Generations and Technology',
      'Internet, Types of Network and e-Governance',
      'Spectrum Policy, Broad Band Policy',
      'Recent Developments in IT & Telecom',
    ],
    'Materials, Nano Technology and Robotics': [
      'Superconductivity Laser, Artificial Intelligence',
      'Nano Technology',
    ],
    'Defence': [
      'Defence Technology',
      'Submarines',
    ],
    'Nuclear Technology': [
      'Nuclear Energy and Nuclear Fuels',
      'Nuclear Programme in India',
      'Organisation Institutions',
      'Radioactivity',
    ],
    'IPR and Other Miscellaneous Issues': [
      'IPR Intellectual Property Rights',
    ],
    'Biotechnology': [
      'Biotechnology in India',
      'Genetics and biotechnology',
      'Biological fuel generation',
      'Environmental biotechnology',
      'Plant and Forest biotechnology',
      'Animal and insect biotechnology',
      'Food and beverage biotechnology',
      'Protection of biotechnological inventions',
      'Recent development in Biotechnology',
    ],
  },
  'General Science': {
    'Biology': [
      'Origin of Life and Cells',
      'Genetics',
      'Classification of Living Things',
      'Evolution of Life',
      'Tissues',
      'Endocrine system',
      'Respiratory System',
      'The Transport System in Organisms',
      'Skeletal and Muscular Systems',
      'Reproductive System',
      'Excretory System',
      'Nutrition',
      'Diseases',
      'Economic Zoology',
      'Recent Development',
    ],
  },
};

export interface FlatSyllabusNode {
  type: 'subject' | 'topic' | 'subtopic';
  subject: string;
  topic?: string;
  subtopic?: string;
  label: string;
  breadcrumb: string;
  keywords: string;
}

/**
 * Pre-compiled flat search index of all syllabus nodes for instant zero-allocation searching.
 */
export const FLAT_SYLLABUS_NODES: FlatSyllabusNode[] = (() => {
  const list: FlatSyllabusNode[] = [];

  for (const [subjectName, topicMap] of Object.entries(MASTER_SYLLABUS_HIERARCHY)) {
    // 1. Subject Node
    list.push({
      type: 'subject',
      subject: subjectName,
      label: subjectName,
      breadcrumb: subjectName,
      keywords: subjectName.toLowerCase(),
    });

    for (const [topicName, subtopics] of Object.entries(topicMap)) {
      // 2. Topic Node
      const topicBreadcrumb = `${subjectName} › ${topicName}`;
      list.push({
        type: 'topic',
        subject: subjectName,
        topic: topicName,
        label: topicName,
        breadcrumb: topicBreadcrumb,
        keywords: `${subjectName} ${topicName}`.toLowerCase(),
      });

      for (const subtopicName of subtopics) {
        // 3. Subtopic Node
        const subtopicBreadcrumb = `${subjectName} › ${topicName} › ${subtopicName}`;
        list.push({
          type: 'subtopic',
          subject: subjectName,
          topic: topicName,
          subtopic: subtopicName,
          label: subtopicName,
          breadcrumb: subtopicBreadcrumb,
          keywords: `${subjectName} ${topicName} ${subtopicName}`.toLowerCase(),
        });
      }
    }
  }

  return list;
})();
