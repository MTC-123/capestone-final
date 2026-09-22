import geopandas as gpd
import matplotlib.pyplot as plt

# Load the NYC Street Centerline (CSCL) GeoJSON file
cscl_file = "NYC Street Centerline (CSCL).geojson"
cscl_gdf = gpd.read_file(cscl_file)

# Print the first few rows to inspect the data
print(cscl_gdf.head())
print(cscl_gdf.columns)

# Load a basemap of New York City
nyc_gdf = gpd.read_file(gpd.datasets.get_path('nybb'))

# Ensure both GeoDataFrames use the same CRS
if cscl_gdf.crs != nyc_gdf.crs:
    cscl_gdf = cscl_gdf.to_crs(nyc_gdf.crs)

# Plot the basemap
ax = nyc_gdf.plot(figsize=(10, 10), color='white', edgecolor='black')

# Plot the street centerlines on the basemap
cscl_gdf.plot(ax=ax, color='red', linewidth=0.5, alpha=0.5)

# Set plot title and labels
plt.title('NYC Street Centerlines')
plt.xlabel('Longitude')
plt.ylabel('Latitude')

# Show plot
plt.show()
