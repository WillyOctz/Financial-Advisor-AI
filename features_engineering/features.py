# ---Categorize Function---

def categorize_transaction(description):
    
    desc = str(description).lower()

    food_keywords = [
        'mcdonalds', 'kfc', 'burger king', 'wendys', 'subway', 'dominos', 'pizza hut',
        'restaurant', 'diner', 'eatery', 'cafe', 'coffee', 'starbucks', 'costa', 'tim hortons',
        'pub', 'bar', 'brewery', 'tavern', 'fast food', 'takeaway', 'delivery', 'grubhub',
        'ubereats', 'doordash', 'food', 'grocery', 'supermarket', 'walmart', 'target', 'tesco',
        'sainsbury', 'aldi', 'lidl', 'costco', 'whole foods', 'trader joe', 'safeway',
        'kroger', 'butcher', 'bakery', 'pastry', 'deli', 'seafood', 'meat', 'vegetable',
        'fruit', 'dairy'
    ]
    
    transport_keywords = [
        'shell', 'bp', 'exxon', 'chevron', 'petrol', 'gas', 'fuel', 'gas station',
        'train', 'railway', 'metro', 'subway', 'bus', 'coach', 'taxi', 'uber', 'lyft',
        'grab', 'bolt', 'transport', 'transit', 'airport', 'airline', 'flight',
        'parking', 'toll', 'highway', 'mot', 'car wash', 'auto repair', 'mechanic',
        'tyre', 'tire', 'insurance', 'registration', 'dmv', 'license'
    ]
    
    shopping_keywords = [
        'amazon', 'ebay', 'etsy', 'apple store', 'google play', 'microsoft store',
        'shopping', 'mall', 'department store', 'retail', 'clothing', 'fashion',
        'h&m', 'zara', 'uniqlo', 'gap', 'nike', 'adidas', 'under armour', 'puma',
        'foot locker', 'jewelry', 'watch', 'accessories', 'cosmetics', 'makeup',
        'sephora', 'ulta', 'pharmacy', 'drugstore', 'cvs', 'walgreens', 'boots',
        'electronics', 'best buy', 'currys', 'media markt', 'furniture', 'ikea',
        'home depot', 'lowes', 'b&q', 'hardware', 'diy', 'bookstore', 'library'
    ]
    
    entertainment_keywords = [
        'netflix', 'spotify', 'youtube premium', 'disney+', 'hulu', 'hbo max',
        'prime video', 'apple tv', 'cinema', 'movie', 'theater', 'concert',
        'ticketmaster', 'event', 'festival', 'museum', 'gallery', 'zoo',
        'aquarium', 'theme park', 'disney', 'universal', 'game', 'steam',
        'playstation', 'xbox', 'nintendo', 'gaming', 'casino', 'lottery',
        'sports', 'gym', 'fitness', 'yoga', 'pool', 'golf', 'tennis'
    ]
    
    utilities_keywords = [
        'electric', 'electricity', 'power', 'energy', 'water', 'sewer', 'gas bill',
        'internet', 'wifi', 'broadband', 'phone', 'mobile', 'cell', 'verizon',
        'at&t', 't-mobile', 'vodafone', 'ee', 'o2', 'cable', 'tv', 'satellite',
        'landline', 'trash', 'waste', 'recycling', 'heating', 'cooling', 'ac'
    ]
    
    rent_keywords = [
        'rent', 'mortgage', 'housing', 'apartment', 'condo', 'lease', 'landlord',
        'property management', 'hoa', 'homeowners association', 'strata', 'council tax'
    ]
    
    income_keywords = [
        'salary', 'paycheck', 'wage', 'income', 'deposit', 'transfer', 'refund',
        'rebate', 'bonus', 'commission', 'dividend', 'interest', 'payment received',
        'reimbursement', 'allowance', 'pension', 'social security', 'benefit'
    ]
    
    healthcare_keywords = [
        'hospital', 'clinic', 'doctor', 'dentist', 'optometrist', 'pharmacy',
        'medical', 'health', 'insurance', 'prescription', 'therapy', 'ambulance',
        'laboratory', 'test', 'scan', 'x-ray', 'surgery', 'dental', 'vision',
        'chiropractor', 'physiotherapy'
    ]
    
    education_keywords = [
        'school', 'college', 'university', 'tuition', 'course', 'training',
        'textbook', 'student', 'education', 'learning', 'seminar', 'workshop'
    ]
    
    travel_keywords = [
        'hotel', 'motel', 'airbnb', 'booking', 'expedia', 'travel', 'vacation',
        'holiday', 'resort', 'cruise', 'car rental', 'hertz', 'avis', 'europcar'
    ]
    
    personal_care_keywords = [
        'haircut', 'salon', 'spa', 'massage', 'manicure', 'pedicure', 'barber',
        'beauty', 'wellness', 'tanning', 'tattoo', 'piercing'
    ]
    
    gifts_donations_keywords = [
        'gift', 'donation', 'charity', 'nonprofit', 'fundraising', 'church',
        'temple', 'mosque', 'religious', 'volunteer', 'go fund me', 'justgiving'
    ]
    
    business_keywords = [
        'office', 'supplies', 'stationery', 'postage', 'shipping', 'fedex',
        'ups', 'dhl', 'printing', 'advertising', 'marketing', 'software',
        'subscription', 'saas', 'cloud', 'hosting', 'domain', 'website'
    ]

    # Check categories in order of priority
    if any(word in desc for word in income_keywords):
        return 'Income'
    elif any(word in desc for word in rent_keywords):
        return 'Rent/Mortgage'
    elif any(word in desc for word in food_keywords):
        return 'Food & Dining'
    elif any(word in desc for word in utilities_keywords):
        return 'Utilities'
    elif any(word in desc for word in transport_keywords):
        return 'Transportation'
    elif any(word in desc for word in healthcare_keywords):
        return 'Healthcare'
    elif any(word in desc for word in education_keywords):
        return 'Education'
    elif any(word in desc for word in entertainment_keywords):
        return 'Entertainment'
    elif any(word in desc for word in shopping_keywords):
        return 'Shopping'
    elif any(word in desc for word in travel_keywords):
        return 'Travel'
    elif any(word in desc for word in personal_care_keywords):
        return 'Personal Care'
    elif any(word in desc for word in gifts_donations_keywords):
        return 'Gifts & Donations'
    elif any(word in desc for word in business_keywords):
        return 'Business Expenses'
    else:
        return 'Others'