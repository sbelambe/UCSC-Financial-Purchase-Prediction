# This is a simple test script to verify that we can connect to Google Drive 
# and list files in the specified folder
import unittest
from unittest.mock import patch, MagicMock
import os, json

# Ensure this imports from your actual backend path
from app.drive import get_drive_service 

class TestDriveServiceAuth(unittest.TestCase):

    @patch('app.drive.is_gcp', True)
    @patch('app.drive.google.auth.default')
    @patch('app.drive.build')
    def test_get_drive_service_gcp(self, mock_build, mock_auth_default):
        """
        Tests if the service prioritizes Google Cloud ADC when is_gcp is True.
        """
        mock_creds = MagicMock()
        mock_auth_default.return_value = (mock_creds, 'dummy_project')
        
        get_drive_service()
        
        mock_auth_default.assert_called_once()
        mock_build.assert_called_once_with("drive", "v3", credentials=mock_creds, cache_discovery=False)

    @patch('app.drive.is_gcp', False)
    @patch.dict(os.environ, {"GOOGLE_CREDENTIALS_JSON": '{"type": "service_account", "project_id": "test"}'})
    @patch('app.drive.service_account.Credentials.from_service_account_info')
    @patch('app.drive.build')
    def test_get_drive_service_vercel_fallback(self, mock_build, mock_from_info):
        """
        Tests if the service successfully falls back to the Vercel JSON environment variable.
        """
        mock_creds = MagicMock()
        mock_from_info.return_value = mock_creds
        
        get_drive_service()
        
        mock_from_info.assert_called_once()
        mock_build.assert_called_once_with("drive", "v3", credentials=mock_creds, cache_discovery=False)

if __name__ == '__main__':
    unittest.main()