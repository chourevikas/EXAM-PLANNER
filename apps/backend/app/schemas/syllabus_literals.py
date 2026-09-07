"""Syllabus Literals and Hierarchy Definition for UPSC Prelims.
Extracted from GS SCORE UPSC Prelims Syllabus Micro Topics Listing.
"""

from typing import Literal, Dict, List, Union, Tuple, Optional

# 1. Subject Literals
SubjectLiteral = Literal[
    "History",
    "Indian Culture",
    "Geography",
    "Ecology & Environment",
    "Indian Polity & Governance",
    "Economy",
    "Science & Technology",
    "General Science",
]

# 2. Topic Literals
TopicLiteral = Literal[
    # History
    "Ancient History",
    "Medieval India",
    "Modern History",
    # Indian Culture
    "Visual Arts",
    "Performing Arts",
    "Religion, Language and Literature",
    "Miscellaneous Culture",
    # Geography
    "General Geography",
    "Geomorphology",
    "Oceanography",
    "Climatology",
    "Bio-Geography",
    "Human and Economic Geography of the World",
    "Indian Geography",
    "World Regional Geography",
    # Ecology & Environment
    "Environmental Ecology",
    "Biodiversity",
    "Resource Degradation and Management",
    "Environmental Pollution",
    "Climate Change",
    "Environmental Governance",
    # Indian Polity & Governance
    "Evolution of the Constitution",
    "Salient Features of Indian Constitution",
    "Union & Its Territory",
    "Citizenship",
    "Fundamental Rights",
    "Directive Principles of State Policy (DPSP)",
    "Fundamental Duties",
    "System of Governance",
    "Union Executive",
    "Union Legislature",
    "State Legislature",
    "Local Government",
    "Union Territories and Special Areas",
    "The Judiciary",
    "Constitutional and Non Constitutional Bodies",
    "Political Dynamics",
    "Governance",
    "International Relations",
    # Economy
    "Basic Concepts",
    "Economic Measurements",
    "Money and Banking",
    "Public Finance in India",
    "Planning",
    "Open Economy",
    "Economic Sectors",
    # Science & Technology
    "Science and Technology in India",
    "Space",
    "IT and Communication",
    "Materials, Nano Technology and Robotics",
    "Defence",
    "Nuclear Technology",
    "IPR and Other Miscellaneous Issues",
    "Biotechnology",
    # General Science
    "Biology",
]

# 3. Subtopic Literals
SubtopicLiteral = Literal[
    # Ancient History
    "Pre Historic Times",
    "Indus Valley Civilization",
    "Rig Vedic Period",
    "Later Vedic Period",
    "Jainism",
    "Buddhism",
    "Mahajanapadas Period",
    "Mauryan Empire",
    "Post-Mauryan India",
    "Gupta Period",
    "Harshavardhana Period",
    "Sangam Period (South Indian Dynasties)",
    # Medieval India
    "Major Dynasties (750-1200) of Early Medieval India",
    "Cholas and Other South Indian Kingdoms",
    "Early Muslim Invasions",
    "The Delhi Sultanate (1206-1526 AD)",
    "Struggle for Empire in North India (Afghans, Rajputs and Mughals)",
    "The Establishment of the North Indian Empire",
    "Consolidation and Expansion of the Empire - Akbar",
    "State and Government under Akbar",
    "Akbar's Religious Views",
    "The Deccan and the Mughals (Up to 1657)",
    "Foreign Policy of the Mughals",
    "India in the First Half of the Seventeenth Century",
    "Climax and Crisis of the Mughal Empire: The Marathas and the Deccan",
    "The Maratha and Other Indian States and Society in The 18th Century",
    "Vijayanagar Empire",
    "Regional States in the Medieval Period",
    "Northern India in the First Half of the Eighteenth Century",
    "Society-Structure and Growth",
    "Economic Life-Patterns and Prospects",
    # Modern History
    "The Advent of Europeans In India",
    "British Expansion in India",
    "Administration before 1857",
    "Economic Policies of The British",
    "Impact of British Administration",
    "The Revolt Of 1857",
    "Administrative Changes After 1857",
    "Development of Civil Services",
    "Development of Education",
    "Development of Press",
    "Socio-Religious Reforms",
    "Personalities",
    "Peasant, Tribal and Other Movements",
    "Revolutionary Nationalism",
    "Indian National Movement - I (1905-1918)",
    "Indian National Movement - II (1918-1929)",
    "Indian National Movement - III (1930-1947)",
    "Governor Generals During British India",
    "Constitutional Development in India",
    # Indian Culture
    "Architecture",
    "Sculptures",
    "Paintings",
    "Pottery Tradition",
    "Numismatics",
    "Music in India",
    "Dances in India",
    "Sports in India",
    "Indian Theatre",
    "Indian Puppetry",
    "Religions in-India",
    "Languages and Literature in India",
    "Philosophy in India",
    "Bhakti & Sufi Movement",
    "Government Cultural Institutions in India",
    "UNESCO List of Cultural Heritage",
    "Protection and Promotion of Indian Culture",
    "Cultural Schemes and Awards",
    "Personalities Related to Culture",
    "Places of Cultural Interest",
    "The Calendar & Eras",
    "Science and Technology in Ancient India",
    "Recent Developments in Culture",
    # Geography
    "Universe",
    "Earth Evolution",
    "Earth's Interior",
    "Geology and Rock system",
    "Geomorphic Processes",
    "Earthquakes and Volcanism",
    "Distribution of Continents & Oceans",
    "Landforms and their evolution",
    "Landforms across the world",
    "Hydrosphere",
    "Submarine Relief Features",
    "Temperature and Salinity",
    "Waves, Ocean Currents, Tides",
    "Marine Resources",
    "Ocean Deposits and Corals",
    "Atmosphere",
    "Inversion of Temperature",
    "Insolation and Heat Budget",
    "Winds and Pressure belts",
    "Air Mass, Fronts, Cyclones and Jet Stream",
    "Precipitation",
    "Climatic Zones of the World",
    "Soil Characteristics",
    "Vegetation resources",
    "Demography and Census",
    "Human Development",
    "Economic activities",
    "Transport and Communication",
    "International Trade",
    "Settlement",
    "Physiography of India",
    "Drainage System",
    "Climate",
    "Soils in India",
    "Natural Vegetation",
    "Population",
    "Settlements and Urbanization",
    "Land Resource",
    "Mineral Resource",
    "Energy resources",
    "Agriculture Basic Terminologies",
    "Recent developments in agriculture field",
    "Productivity of Crops and conditions for growth",
    "Industry",
    "Transport",
    "Recent Development in Transport Sector",
    "Recent developments in Industrial Sector",
    "Continents Countries and Cities",
    "Location in NEWS",
    # Ecology & Environment
    "Origin of Life forms",
    "Basic Concepts of Ecology",
    "Ecosystem functions",
    "Population Ecology",
    "Adaptation of Species and Interactions",
    "Terrestrial ecosystems",
    "Aquatic ecosystem",
    "Nutrient Cycling",
    "Basics of Biodiversity",
    "Animal and Plant Diversity",
    "Threats to biodiversity",
    "Biodiversity Conservation",
    "Estuaries",
    "Mangroves",
    "Coral Reef",
    "Wetlands",
    "Forest resource",
    "Soil Resource",
    "Water Pollution",
    "Energy Resources",
    "Basics of Pollution",
    "Mining and pollution",
    "Air pollution",
    "Marine Pollution",
    "Noise Pollution",
    "Biological Pollution",
    "Radioactive Pollution",
    "Thermal Pollution",
    "Waste Management",
    "Climate Change Basics",
    "Climate Change Impact",
    "Acts and Policies",
    "Environment Impact Assessment (EIA)",
    "International Environmental Governance",
    "India and Climate Change",
    "Environment related Institutions in India",
    "Environmental schemes in India",
    "Appendix & Recent Developments",
    # Indian Polity & Governance
    "The Company Rule (1773-1858)",
    "The Crown Rule (1858-1947)",
    "Drafting and Sources of Indian Constitution",
    "Constitution and Types",
    "Types of Political System",
    "Types of Majorities as per the Indian Constitution",
    "Preamble and Values in the Constitution",
    "Amendment of The Constitution",
    "Doctrine and Terms",
    "Other Constitutional Dimensions",
    "Article 1-4",
    "Constitutional Provisions",
    "Indian Diaspora",
    "Evolution Objectives And Features",
    "Article 12 and Article 13",
    "Right to Equality",
    "Right to Freedom",
    "Right against Exploitation",
    "Right to Freedom of Religion",
    "Cultural and Educational Rights",
    "Right to Constitutional Remedies",
    "FR's other Dimensions",
    "Evolution, objectives, and features",
    "Socialistic Principles",
    "Gandhian Principles",
    "Liberal-Intellectual Principles",
    "Directive Principle Outside Part IV",
    "Article 51A",
    "Recent developments",
    "Centre-State Relations",
    "Inter State Relation",
    "Special Provisions for some States",
    "Types of Emergencies",
    "President",
    "Vice President",
    "The Prime Minister",
    "Union Council of Minister",
    "Organisation of Parliament",
    "Parliament, Lok Sabha and Rajya Sabha",
    "Legislative Procedure and Committees of Parliament",
    "Governor",
    "The Chief Minister and the CoM",
    "Legislative Assembly",
    "Legislative Council (Article 169)",
    "Panchayati Raj",
    "Urban Local Government",
    "Union Territories",
    "Schedule and Tribal Areas",
    "The Supreme Court",
    "The High Court Subordinate Courts & Lok Adalats",
    "Constitutional Bodies",
    "Non Constitutional",
    "Political Parties and Election",
    "Pressure Groups",
    "Governing Institutions in India",
    "Audit and other Transparency initiatives",
    "Role of SHG, NGOs, Civil Society",
    "Social Sector Bills",
    "Welfare Schemes",
    "India's Foreign Policy",
    "South Asia",
    "Central Asia",
    "West Asia",
    "Asia - Pacific",
    "Africa",
    "Europe",
    "US-China",
    "Indian Ocean Region",
    # Economy
    "Macroeconomic Concepts",
    "Microeconomic Concepts",
    "National Income Concepts and Methods of Calculation",
    "Inflation",
    "Economic Growth and Development",
    "Money Function and Classification",
    "Financial Market and its Instruments",
    "Banking Structure in India",
    "Budgeting",
    "Fiscal Policy",
    "Centre State Distribution",
    "Tax Structure in India",
    "Meaning Objectives and History",
    "Planning Institutions",
    "Five Year Plans in India",
    "Foreign Trade Concepts",
    "Trade Policy and Agreements",
    "Exchange Rate",
    "International Organization",
    "Trade Agreements",
    "Recent Developments in External Sector",
    "Poverty",
    "Employment",
    "Government Schemes and Programs",
    "Committees",
    # Science & Technology
    "Policy Development of S&T in India",
    "Different Organization Institution and Various Department for the S&T",
    "Space Research Programme, Orbits and Launch",
    "Satellites, Launch Vehicles and India Satellite Programmes",
    "Different Regulatory Bodies in India for ICT",
    "Computer Terminology and Fundamental",
    "Mobile Generations and Technology",
    "Internet, Types of Network and e-Governance",
    "Spectrum Policy, Broad Band Policy",
    "Recent Developments in IT & Telecom",
    "Superconductivity Laser, Artificial Intelligence",
    "Nano Technology",
    "Defence Technology",
    "Submarines",
    "Nuclear Energy and Nuclear Fuels",
    "Nuclear Programme in India",
    "Organisation Institutions",
    "Radioactivity",
    "IPR Intellectual Property Rights",
    "Biotechnology in India",
    "Genetics and biotechnology",
    "Biological fuel generation",
    "Environmental biotechnology",
    "Plant and Forest biotechnology",
    "Animal and insect biotechnology",
    "Food and beverage biotechnology",
    "Protection of biotechnological inventions",
    "Recent development in Biotechnology",
    # General Science
    "Origin of Life and Cells",
    "Genetics",
    "Classification of Living Things",
    "Evolution of Life",
    "Tissues",
    "Endocrine system",
    "Respiratory System",
    "The Transport System in Organisms",
    "Skeletal and Muscular Systems",
    "Reproductive System",
    "Excretory System",
    "Nutrition",
    "Diseases",
    "Economic Zoology",
    "Recent Development",
]


# Structured Hierarchy Data Dictionary
SYLLABUS_HIERARCHY: Dict[str, Dict[str, List[str]]] = {
    "History": {
        "Ancient History": [
            "Pre Historic Times",
            "Indus Valley Civilization",
            "Rig Vedic Period",
            "Later Vedic Period",
            "Jainism",
            "Buddhism",
            "Mahajanapadas Period",
            "Mauryan Empire",
            "Post-Mauryan India",
            "Gupta Period",
            "Harshavardhana Period",
            "Sangam Period (South Indian Dynasties)",
        ],
        "Medieval India": [
            "Major Dynasties (750-1200) of Early Medieval India",
            "Cholas and Other South Indian Kingdoms",
            "Early Muslim Invasions",
            "The Delhi Sultanate (1206-1526 AD)",
            "Struggle for Empire in North India (Afghans, Rajputs and Mughals)",
            "The Establishment of the North Indian Empire",
            "Consolidation and Expansion of the Empire - Akbar",
            "State and Government under Akbar",
            "Akbar's Religious Views",
            "The Deccan and the Mughals (Up to 1657)",
            "Foreign Policy of the Mughals",
            "India in the First Half of the Seventeenth Century",
            "Climax and Crisis of the Mughal Empire: The Marathas and the Deccan",
            "The Maratha and Other Indian States and Society in The 18th Century",
            "Vijayanagar Empire",
            "Regional States in the Medieval Period",
            "Northern India in the First Half of the Eighteenth Century",
            "Society-Structure and Growth",
            "Economic Life-Patterns and Prospects",
        ],
        "Modern History": [
            "The Advent of Europeans In India",
            "British Expansion in India",
            "Administration before 1857",
            "Economic Policies of The British",
            "Impact of British Administration",
            "The Revolt Of 1857",
            "Administrative Changes After 1857",
            "Development of Civil Services",
            "Development of Education",
            "Development of Press",
            "Socio-Religious Reforms",
            "Personalities",
            "Peasant, Tribal and Other Movements",
            "Revolutionary Nationalism",
            "Indian National Movement - I (1905-1918)",
            "Indian National Movement - II (1918-1929)",
            "Indian National Movement - III (1930-1947)",
            "Governor Generals During British India",
            "Constitutional Development in India",
        ],
    },
    "Indian Culture": {
        "Visual Arts": [
            "Architecture",
            "Sculptures",
            "Paintings",
            "Pottery Tradition",
            "Numismatics",
        ],
        "Performing Arts": [
            "Music in India",
            "Dances in India",
            "Sports in India",
            "Indian Theatre",
            "Indian Puppetry",
        ],
        "Religion, Language and Literature": [
            "Religions in-India",
            "Languages and Literature in India",
            "Philosophy in India",
            "Bhakti & Sufi Movement",
        ],
        "Miscellaneous Culture": [
            "Government Cultural Institutions in India",
            "UNESCO List of Cultural Heritage",
            "Protection and Promotion of Indian Culture",
            "Cultural Schemes and Awards",
            "Personalities Related to Culture",
            "Places of Cultural Interest",
            "The Calendar & Eras",
            "Science and Technology in Ancient India",
            "Recent Developments in Culture",
        ],
    },
    "Geography": {
        "General Geography": [
            "Universe",
            "Earth Evolution",
        ],
        "Geomorphology": [
            "Earth's Interior",
            "Geology and Rock system",
            "Geomorphic Processes",
            "Earthquakes and Volcanism",
            "Distribution of Continents & Oceans",
            "Landforms and their evolution",
            "Landforms across the world",
        ],
        "Oceanography": [
            "Hydrosphere",
            "Submarine Relief Features",
            "Temperature and Salinity",
            "Waves, Ocean Currents, Tides",
            "Marine Resources",
            "Ocean Deposits and Corals",
        ],
        "Climatology": [
            "Atmosphere",
            "Inversion of Temperature",
            "Insolation and Heat Budget",
            "Winds and Pressure belts",
            "Air Mass, Fronts, Cyclones and Jet Stream",
            "Precipitation",
            "Climatic Zones of the World",
        ],
        "Bio-Geography": [
            "Soil Characteristics",
            "Vegetation resources",
        ],
        "Human and Economic Geography of the World": [
            "Demography and Census",
            "Human Development",
            "Economic activities",
            "Transport and Communication",
            "International Trade",
            "Settlement",
        ],
        "Indian Geography": [
            "Physiography of India",
            "Drainage System",
            "Climate",
            "Soils in India",
            "Natural Vegetation",
            "Population",
            "Settlements and Urbanization",
            "Land Resource",
            "Mineral Resource",
            "Energy resources",
            "Agriculture Basic Terminologies",
            "Recent developments in agriculture field",
            "Productivity of Crops and conditions for growth",
            "Industry",
            "Transport",
            "Recent Development in Transport Sector",
            "Recent developments in Industrial Sector",
        ],
        "World Regional Geography": [
            "Continents Countries and Cities",
            "Location in NEWS",
        ],
    },
    "Ecology & Environment": {
        "Environmental Ecology": [
            "Origin of Life forms",
            "Basic Concepts of Ecology",
            "Ecosystem functions",
            "Population Ecology",
            "Adaptation of Species and Interactions",
            "Terrestrial ecosystems",
            "Aquatic ecosystem",
            "Nutrient Cycling",
        ],
        "Biodiversity": [
            "Basics of Biodiversity",
            "Animal and Plant Diversity",
            "Threats to biodiversity",
            "Biodiversity Conservation",
            "Estuaries",
            "Mangroves",
            "Coral Reef",
            "Wetlands",
        ],
        "Resource Degradation and Management": [
            "Land Resource",
            "Forest resource",
            "Soil Resource",
            "Water Pollution",
            "Energy Resources",
        ],
        "Environmental Pollution": [
            "Basics of Pollution",
            "Mining and pollution",
            "Air pollution",
            "Marine Pollution",
            "Noise Pollution",
            "Biological Pollution",
            "Radioactive Pollution",
            "Thermal Pollution",
            "Waste Management",
        ],
        "Climate Change": [
            "Climate Change Basics",
            "Climate Change Impact",
        ],
        "Environmental Governance": [
            "Acts and Policies",
            "Environment Impact Assessment (EIA)",
            "International Environmental Governance",
            "India and Climate Change",
            "Environment related Institutions in India",
            "Environmental schemes in India",
            "Appendix & Recent Developments",
        ],
    },
    "Indian Polity & Governance": {
        "Evolution of the Constitution": [
            "The Company Rule (1773-1858)",
            "The Crown Rule (1858-1947)",
            "Drafting and Sources of Indian Constitution",
        ],
        "Salient Features of Indian Constitution": [
            "Constitution and Types",
            "Types of Political System",
            "Types of Majorities as per the Indian Constitution",
            "Preamble and Values in the Constitution",
            "Amendment of The Constitution",
            "Doctrine and Terms",
            "Other Constitutional Dimensions",
        ],
        "Union & Its Territory": [
            "Article 1-4",
        ],
        "Citizenship": [
            "Constitutional Provisions",
            "Indian Diaspora",
        ],
        "Fundamental Rights": [
            "Evolution Objectives And Features",
            "Article 12 and Article 13",
            "Right to Equality",
            "Right to Freedom",
            "Right against Exploitation",
            "Right to Freedom of Religion",
            "Cultural and Educational Rights",
            "Right to Constitutional Remedies",
            "FR's other Dimensions",
        ],
        "Directive Principles of State Policy (DPSP)": [
            "Evolution, objectives, and features",
            "Socialistic Principles",
            "Gandhian Principles",
            "Liberal-Intellectual Principles",
            "Directive Principle Outside Part IV",
        ],
        "Fundamental Duties": [
            "Article 51A",
            "Recent developments",
        ],
        "System of Governance": [
            "Centre-State Relations",
            "Inter State Relation",
            "Special Provisions for some States",
            "Types of Emergencies",
        ],
        "Union Executive": [
            "President",
            "Vice President",
            "The Prime Minister",
            "Union Council of Minister",
        ],
        "Union Legislature": [
            "Organisation of Parliament",
            "Parliament, Lok Sabha and Rajya Sabha",
            "Legislative Procedure and Committees of Parliament",
        ],
        "State Legislature": [
            "Governor",
            "The Chief Minister and the CoM",
            "Legislative Assembly",
            "Legislative Council (Article 169)",
        ],
        "Local Government": [
            "Panchayati Raj",
            "Urban Local Government",
        ],
        "Union Territories and Special Areas": [
            "Union Territories",
            "Schedule and Tribal Areas",
        ],
        "The Judiciary": [
            "The Supreme Court",
            "The High Court Subordinate Courts & Lok Adalats",
        ],
        "Constitutional and Non Constitutional Bodies": [
            "Constitutional Bodies",
            "Non Constitutional",
        ],
        "Political Dynamics": [
            "Political Parties and Election",
            "Pressure Groups",
        ],
        "Governance": [
            "Governing Institutions in India",
            "Audit and other Transparency initiatives",
            "Role of SHG, NGOs, Civil Society",
            "Social Sector Bills",
            "Welfare Schemes",
        ],
        "International Relations": [
            "India's Foreign Policy",
            "South Asia",
            "Central Asia",
            "West Asia",
            "Asia - Pacific",
            "Africa",
            "Europe",
            "US-China",
            "Indian Ocean Region",
        ],
    },
    "Economy": {
        "Basic Concepts": [
            "Macroeconomic Concepts",
            "Microeconomic Concepts",
        ],
        "Economic Measurements": [
            "National Income Concepts and Methods of Calculation",
            "Inflation",
            "Economic Growth and Development",
        ],
        "Money and Banking": [
            "Money Function and Classification",
            "Financial Market and its Instruments",
            "Banking Structure in India",
        ],
        "Public Finance in India": [
            "Budgeting",
            "Fiscal Policy",
            "Centre State Distribution",
            "Tax Structure in India",
        ],
        "Planning": [
            "Meaning Objectives and History",
            "Planning Institutions",
            "Five Year Plans in India",
        ],
        "Open Economy": [
            "Foreign Trade Concepts",
            "Trade Policy and Agreements",
            "Exchange Rate",
            "International Organization",
            "Trade Agreements",
            "Recent Developments in External Sector",
        ],
        "Economic Sectors": [
            "Poverty",
            "Employment",
            "Government Schemes and Programs",
            "Committees",
        ],
    },
    "Science & Technology": {
        "Science and Technology in India": [
            "Policy Development of S&T in India",
            "Different Organization Institution and Various Department for the S&T",
        ],
        "Space": [
            "Space Research Programme, Orbits and Launch",
            "Satellites, Launch Vehicles and India Satellite Programmes",
            "Recent developments",
        ],
        "IT and Communication": [
            "Different Regulatory Bodies in India for ICT",
            "Computer Terminology and Fundamental",
            "Mobile Generations and Technology",
            "Internet, Types of Network and e-Governance",
            "Spectrum Policy, Broad Band Policy",
            "Recent Developments in IT & Telecom",
        ],
        "Materials, Nano Technology and Robotics": [
            "Superconductivity Laser, Artificial Intelligence",
            "Nano Technology",
        ],
        "Defence": [
            "Defence Technology",
            "Submarines",
        ],
        "Nuclear Technology": [
            "Nuclear Energy and Nuclear Fuels",
            "Nuclear Programme in India",
            "Organisation Institutions",
            "Radioactivity",
        ],
        "IPR and Other Miscellaneous Issues": [
            "IPR Intellectual Property Rights",
        ],
        "Biotechnology": [
            "Biotechnology in India",
            "Genetics and biotechnology",
            "Biological fuel generation",
            "Environmental biotechnology",
            "Plant and Forest biotechnology",
            "Animal and insect biotechnology",
            "Food and beverage biotechnology",
            "Protection of biotechnological inventions",
            "Recent development in Biotechnology",
        ],
    },
    "General Science": {
        "Biology": [
            "Origin of Life and Cells",
            "Genetics",
            "Classification of Living Things",
            "Evolution of Life",
            "Tissues",
            "Endocrine system",
            "Respiratory System",
            "The Transport System in Organisms",
            "Skeletal and Muscular Systems",
            "Reproductive System",
            "Excretory System",
            "Nutrition",
            "Diseases",
            "Economic Zoology",
            "Recent Development",
        ],
    },
}

# Lookups for parent-child relationship auto-repair
SUBTOPIC_TO_PARENT_MAP: Dict[str, Tuple[str, str, str]] = {}
TOPIC_TO_PARENT_MAP: Dict[str, Tuple[str, str]] = {}

for _subject, _topics in SYLLABUS_HIERARCHY.items():
    for _topic, _subtopics in _topics.items():
        TOPIC_TO_PARENT_MAP[_topic.lower()] = (_topic, _subject)
        for _subtopic in _subtopics:
            SUBTOPIC_TO_PARENT_MAP[_subtopic.lower()] = (_subtopic, _topic, _subject)


def get_canonical_parents(
    subject: Optional[str], topic: Optional[str], subtopic: Optional[str] = None
) -> Tuple[str, str, Optional[str]]:
    """
    Validates and auto-repairs Subject -> Topic -> Subtopic hierarchy relationships.
    Handles empty/None values and guarantees non-empty canonical subject & topic outputs.
    If subtopic is known in SYLLABUS_HIERARCHY, auto-corrects topic and subject.
    Else if topic is known, auto-corrects subject.
    Returns (canonical_subject, canonical_topic, canonical_subtopic).
    """
    clean_subtop = subtopic.strip() if subtopic and isinstance(subtopic, str) and subtopic.strip() else None
    clean_top = topic.strip() if topic and isinstance(topic, str) and topic.strip() else ""
    clean_subj = subject.strip() if subject and isinstance(subject, str) and subject.strip() else ""

    if clean_subtop and clean_subtop.lower() in SUBTOPIC_TO_PARENT_MAP:
        c_subtop, c_top, c_subj = SUBTOPIC_TO_PARENT_MAP[clean_subtop.lower()]
        return c_subj, c_top, c_subtop

    if clean_top and clean_top.lower() in TOPIC_TO_PARENT_MAP:
        c_top, c_subj = TOPIC_TO_PARENT_MAP[clean_top.lower()]
        return c_subj, c_top, clean_subtop

    final_subj = clean_subj
    final_top = clean_top
    return final_subj, final_top, clean_subtop


def is_valid_subject(name: Optional[str]) -> bool:
    """Checks if subject name exists in canonical SYLLABUS_HIERARCHY."""
    if not name or not isinstance(name, str):
        return False
    clean = name.strip().lower()
    return any(subj.lower() == clean for subj in SYLLABUS_HIERARCHY.keys())


def is_valid_topic(name: Optional[str], subject_name: Optional[str] = None) -> bool:
    """Checks if topic name exists in canonical SYLLABUS_HIERARCHY, optionally under subject_name."""
    if not name or not isinstance(name, str):
        return False
    clean_topic = name.strip().lower()
    if subject_name and subject_name.strip():
        clean_subj = subject_name.strip().lower()
        for subj, topics in SYLLABUS_HIERARCHY.items():
            if subj.lower() == clean_subj:
                return any(t.lower() == clean_topic for t in topics.keys())
        return False
    return clean_topic in TOPIC_TO_PARENT_MAP


def is_valid_subtopic(
    name: Optional[str], topic_name: Optional[str] = None, subject_name: Optional[str] = None
) -> bool:
    """Checks if subtopic name exists in canonical SYLLABUS_HIERARCHY, optionally under topic/subject."""
    if not name or not isinstance(name, str):
        return False
    clean_subtop = name.strip().lower()
    if topic_name and topic_name.strip():
        clean_top = topic_name.strip().lower()
        for subj, topics in SYLLABUS_HIERARCHY.items():
            if subject_name and subj.lower() != subject_name.strip().lower():
                continue
            for top, subtopics in topics.items():
                if top.lower() == clean_top:
                    return any(st.lower() == clean_subtop for st in subtopics)
        return False
    return clean_subtop in SUBTOPIC_TO_PARENT_MAP


def verify_syllabus_node(
    subject: Optional[str], topic: Optional[str], subtopic: Optional[str] = None
) -> Tuple[str, str, Optional[str], bool, Optional[str]]:
    """
    Strictly verifies and auto-repairs Subject -> Topic -> Subtopic against SYLLABUS_HIERARCHY.
    Returns (canonical_subject, canonical_topic, canonical_subtopic, is_canonical_exact_match, issue_reason).
    """
    clean_subj = (subject or "").strip()
    clean_top = (topic or "").strip()
    clean_subtop = (subtopic or "").strip() if subtopic else None

    # Check exact match
    subj_exact = is_valid_subject(clean_subj)
    top_exact = is_valid_topic(clean_top, clean_subj) if subj_exact else is_valid_topic(clean_top)
    subtop_exact = is_valid_subtopic(clean_subtop, clean_top, clean_subj) if clean_subtop else True

    if clean_subj:
        # Preserve modern pipeline subject directly rather than forcing into legacy parent
        return clean_subj, clean_top or clean_subj, clean_subtop, True, None

    if subj_exact and top_exact and subtop_exact:
        c_subj, c_top, c_subtop = get_canonical_parents(clean_subj, clean_top, clean_subtop)
        return c_subj, c_top, c_subtop, True, None

    # If mismatch, auto-repair to canonical parents
    c_subj, c_top, c_subtop = get_canonical_parents(clean_subj, clean_top, clean_subtop)
    reasons = []
    if not subj_exact:
        reasons.append(f"Subject '{clean_subj}' is non-canonical (repaired to '{c_subj}')")
    if not top_exact:
        reasons.append(f"Topic '{clean_top}' is non-canonical (repaired to '{c_top}')")
    if clean_subtop and not subtop_exact:
        reasons.append(f"Subtopic '{clean_subtop}' is non-canonical (repaired to '{c_subtop}')")

    issue_msg = "; ".join(reasons) if reasons else "Syllabus node required auto-repair"
    return c_subj, c_top, c_subtop, False, issue_msg


def get_complete_master_syllabus() -> Dict[str, any]:
    """Builds and returns the complete structured syllabus hierarchy with metadata and counts."""
    subjects_list = []
    topics_list = []
    subtopics_list = []
    flat_hierarchy: Dict[str, List[str]] = {}

    subjects_items = []
    subj_idx = 1
    total_subtopics_count = 0
    total_topics_count = 0

    for subject_name, topics_dict in SYLLABUS_HIERARCHY.items():
        subjects_list.append(subject_name)
        topic_items = []
        top_idx = 1
        subj_subtopics_count = 0

        for topic_name, subtopics_arr in topics_dict.items():
            topics_list.append(topic_name)
            flat_hierarchy[topic_name] = list(subtopics_arr)
            subtop_items = []
            st_idx = 1

            for st_name in subtopics_arr:
                subtopics_list.append(st_name)
                code_st = st_name.strip().upper().replace(" ", "_").replace("&", "AND")[:50]
                subtop_items.append({
                    "id": None,
                    "name": st_name,
                    "code": code_st,
                    "display_order": st_idx,
                    "pyq_frequency": 0,
                })
                st_idx += 1

            subj_subtopics_count += len(subtopics_arr)
            total_subtopics_count += len(subtopics_arr)
            total_topics_count += 1

            code_top = topic_name.strip().upper().replace(" ", "_").replace("&", "AND")[:50]
            topic_items.append({
                "id": None,
                "name": topic_name,
                "code": code_top,
                "display_order": top_idx,
                "subtopics_count": len(subtopics_arr),
                "subtopics": subtop_items,
            })
            top_idx += 1

        code_subj = subject_name.strip().upper().replace(" ", "_").replace("&", "AND")[:50]
        subjects_items.append({
            "id": None,
            "name": subject_name,
            "code": code_subj,
            "display_order": subj_idx,
            "topics_count": len(topics_dict),
            "subtopics_count": subj_subtopics_count,
            "topics": topic_items,
        })
        subj_idx += 1

    return {
        "version_code": "UPSC_PRELIMS_MASTER_V1",
        "title": "UPSC Prelims Master Syllabus (GS Micro-Topics)",
        "syllabus_version_id": None,
        "exam_id": None,
        "total_subjects": len(SYLLABUS_HIERARCHY),
        "total_topics": total_topics_count,
        "total_subtopics": total_subtopics_count,
        "subjects": subjects_items,
        "hierarchy": {k: {tk: list(tv) for tk, tv in v.items()} for k, v in SYLLABUS_HIERARCHY.items()},
        "flat_hierarchy": flat_hierarchy,
        "subjects_list": subjects_list,
        "topics_list": sorted(list(set(topics_list))),
        "subtopics_list": sorted(list(set(subtopics_list))),
    }


