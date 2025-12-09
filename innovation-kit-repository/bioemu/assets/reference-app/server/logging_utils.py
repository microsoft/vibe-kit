"""
BioEmu logging utilities with enhanced visibility for API tracking.
"""

import logging
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(message)s")
logger = logging.getLogger(__name__)


def log_bioemu_info(message):
    """Log BioEmu-specific information with enhanced visibility"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"\n🧬 [{timestamp}] BIOEMU API TRACKER: {message}")
    logger.info(f"BIOEMU: {message}")


def log_bioemu_error(message):
    """Log BioEmu errors with enhanced visibility"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"\n❌ [{timestamp}] BIOEMU ERROR: {message}")
    logger.error(f"BIOEMU ERROR: {message}")


def log_bioemu_success(message):
    """Log BioEmu success with enhanced visibility"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"\n✅ [{timestamp}] BIOEMU SUCCESS: {message}")
    logger.info(f"BIOEMU SUCCESS: {message}")


def log_bioemu_data(title, data, max_length=100):
    """Log BioEmu data with smart truncation for visibility"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    if isinstance(data, dict):
        # For dictionaries, show structure
        keys = list(data.keys())
        print(
            f"📊 [{timestamp}] {title}: Dict with keys: {keys[:5]}{'...' if len(keys) > 5 else ''}"
        )
        if "pdb_data" in data:
            print(f"    🧪 PDB Data: {len(str(data['pdb_data']))} characters")
        if "xtc_data" in data:
            print(f"    🎬 XTC Data: {len(str(data['xtc_data']))} characters")
    elif isinstance(data, (str, bytes)):
        data_str = str(data)
        print(
            f"📊 [{timestamp}] {title}: {data_str[:max_length]}{'...' if len(data_str) > max_length else ''} (length: {len(data_str)})"
        )
    else:
        print(
            f"📊 [{timestamp}] {title}: {str(data)[:max_length]}{'...' if len(str(data)) > max_length else ''}"
        )


def log_bioemu_timing(operation, start_time, end_time):
    """Log timing information for BioEmu operations"""
    duration = end_time - start_time
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"⏱️  [{timestamp}] {operation}: {duration:.2f} seconds")


def print_separator():
    """Print a visual separator for log clarity"""
    print("\n" + "🔬" + "=" * 58 + "🔬")
