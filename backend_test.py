import requests
import sys
import json
from datetime import datetime

class AfMaayAPITester:
    def __init__(self, base_url="https://maayai.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.session_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}" if not endpoint.startswith('http') else endpoint
        test_headers = {'Content-Type': 'application/json'}
        if headers:
            test_headers.update(headers)
        if self.session_token:
            test_headers['Authorization'] = f'Bearer {self.session_token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {"raw_response": response.text}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")
                self.failed_tests.append({
                    "test": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "response": response.text[:500]
                })
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                "test": name,
                "error": str(e)
            })
            return False, {}

    def test_health_endpoints(self):
        """Test basic health endpoints"""
        print("\n" + "="*50)
        print("TESTING HEALTH ENDPOINTS")
        print("="*50)
        
        # Test root endpoint
        self.run_test("Root API", "GET", "", 200)
        
        # Test health endpoint
        self.run_test("Health Check", "GET", "health", 200)

    def test_dictionary_endpoints(self):
        """Test dictionary functionality"""
        print("\n" + "="*50)
        print("TESTING DICTIONARY ENDPOINTS")
        print("="*50)
        
        # Test get dictionary entries
        success, response = self.run_test("Get Dictionary Entries", "GET", "dictionary", 200)
        
        # Test dictionary search
        self.run_test("Dictionary Search - English", "GET", "dictionary?search=hello&language=en", 200)
        self.run_test("Dictionary Search - Maay", "GET", "dictionary?search=salaan&language=maay", 200)
        
        # Test sound group filter
        self.run_test("Dictionary Filter - Sound Group", "GET", "dictionary?sound_group=k", 200)
        
        # Test verified only filter
        self.run_test("Dictionary Filter - Verified Only", "GET", "dictionary?verified_only=true", 200)

    def test_translation_endpoint(self):
        """Test translation functionality"""
        print("\n" + "="*50)
        print("TESTING TRANSLATION ENDPOINT")
        print("="*50)
        
        # Test English to Maay translation
        translation_data = {
            "text": "Hello, how are you?",
            "source_language": "en",
            "target_language": "maay"
        }
        success, response = self.run_test("Translate EN to Maay", "POST", "translate", 200, translation_data)
        
        if success and response:
            print(f"   Translation: {response.get('translated_text', 'N/A')}")
            if response.get('vocabulary_gaps'):
                print(f"   Vocabulary gaps: {response['vocabulary_gaps']}")
        
        # Test Maay to English translation
        translation_data_reverse = {
            "text": "Salaan",
            "source_language": "maay", 
            "target_language": "en"
        }
        self.run_test("Translate Maay to EN", "POST", "translate", 200, translation_data_reverse)

    def test_chat_endpoint(self):
        """Test chat functionality"""
        print("\n" + "="*50)
        print("TESTING CHAT ENDPOINT")
        print("="*50)
        
        # Test chat without auth (should work for anonymous)
        chat_data = {
            "message": "Hello, can you help me learn Af Maay?",
            "language": "en"
        }
        success, response = self.run_test("Chat - Anonymous", "POST", "chat", 200, chat_data)
        
        if success and response:
            print(f"   AI Response: {response.get('response', 'N/A')[:100]}...")
            print(f"   Conversation ID: {response.get('conversation_id', 'N/A')}")

    def test_voice_endpoints(self):
        """Test voice functionality (basic endpoint availability)"""
        print("\n" + "="*50)
        print("TESTING VOICE ENDPOINTS")
        print("="*50)
        
        # Test TTS endpoint
        tts_data = {
            "text": "Hello",
            "voice": "alloy"
        }
        self.run_test("Text-to-Speech", "POST", "voice/synthesize", 200, tts_data)
        
        # Note: We can't easily test transcription without actual audio file

    def test_auth_endpoints(self):
        """Test authentication endpoints"""
        print("\n" + "="*50)
        print("TESTING AUTH ENDPOINTS")
        print("="*50)
        
        # Test get current user (should fail without auth)
        self.run_test("Get Current User - No Auth", "GET", "auth/me", 401)
        
        # Test logout
        self.run_test("Logout", "POST", "auth/logout", 200)

    def test_admin_endpoints(self):
        """Test admin endpoints (should require auth)"""
        print("\n" + "="*50)
        print("TESTING ADMIN ENDPOINTS")
        print("="*50)
        
        # Test admin stats (should fail without auth)
        self.run_test("Admin Stats - No Auth", "GET", "admin/stats", 401)

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Af Maay AI Platform API Tests")
        print(f"Base URL: {self.base_url}")
        print(f"API URL: {self.api_url}")
        
        # Run test suites
        self.test_health_endpoints()
        self.test_dictionary_endpoints()
        self.test_translation_endpoint()
        self.test_chat_endpoint()
        self.test_voice_endpoints()
        self.test_auth_endpoints()
        self.test_admin_endpoints()
        
        # Print summary
        print("\n" + "="*60)
        print("TEST SUMMARY")
        print("="*60)
        print(f"📊 Tests passed: {self.tests_passed}/{self.tests_run}")
        print(f"📊 Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if self.failed_tests:
            print(f"\n❌ Failed tests ({len(self.failed_tests)}):")
            for i, test in enumerate(self.failed_tests, 1):
                print(f"   {i}. {test.get('test', 'Unknown')}")
                if 'error' in test:
                    print(f"      Error: {test['error']}")
                else:
                    print(f"      Expected: {test.get('expected')}, Got: {test.get('actual')}")
        
        return self.tests_passed == self.tests_run

def main():
    tester = AfMaayAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())