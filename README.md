

# Cấu trúc Project
hbt-routing-system/
├── data/                       
│   ├── raw/                   
│   └── processed/              
├── src/                       
│   ├── data_processing/        
│   │   ├── osm_parser.py       
│   │   ├── spatial_index.py    
│   │   └── traffic_manager.py  
│   ├── core/                  
│   │   ├── a_star.py           
│   │   └── cost_functions.py  
│   ├── api/                    
│   │   └── main.py            
│   └── utils/                  
├── frontend/                   
│   └── src/
│       ├── components/         
│       └── api.js              
├── notebooks/                 
├── tests/                      
├── requirements.txt            
└── main.py                     
