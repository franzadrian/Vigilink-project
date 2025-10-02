import os
import io
import dropbox
from dropbox.files import WriteMode
from dropbox.exceptions import ApiError, AuthError
from django.conf import settings
import uuid

# Dropbox credentials
APP_KEY = 'f914jvtjswclyju'
APP_SECRET = 'bbp5ai89wgrotx6'
ACCESS_TOKEN = 'sl.u.AGApGLcR3eTJZ_T6RVs5O99-JC3bFShBvqEFUcC7Kl7WYkXxcZyxXgclsdot16tkwNc_UnLk7YBQWYEzq7FBoVxav1mGZOgXLFFclA5oiYIbBac66LljaHJecBDD3rgYSjRZlmmU7fGktufeT8qvqwpzCJpmvgoCajvezPCNe7jAsTIgInWjn8JD8fGl_ZL4dEursWZa7moF-BXTi3036bgAtUVrSPnlGrt3gmpkV7WdaxLMzLjsjVktkkTfQ2PvjT3y-Cj3JDZ6tfZ-jFW_pY8f9IGeiq3uGTJf9Yb-KvUeg-CxHotJcPQd6sdP7zRLbWx-o-WGTlUREM-TBJ7H07ZrBDdFQNT7dvqIIuQGil6x7mw4RIjRAKc9pGvhKK8X7I7FtdEsAc9csAOeG3SslQNbIW1pX9gyx0_8_pxW4AgjmMUdBXMeoufBsXaRWF_NVlDAyduXuAwX_pp14rQ4JkjcPntyDZn6cKsgDPnClSnUGu3OdPzC44iyZHU71DmJ-hhtLSNBk4FGo3gvk0btltDJZRdooGtd3l5o0nivqGma4k1u3Pre-qG6-1yJgfMpeqFszCx4AUYoqqyq7QpnaKQx8OQGU5SIwV48vWh4ePMt9FXSueaP-jB1_dySsHNyJ9L_-4MsGZtemGy1_SLmeddpxKHtsyCLluqEW3vljKgMJwatgXJJ_mg4Sq2lV6wQDUAoMxq3tTotgfZKtnd8pNAOWoaiFN_Znvv3XV9hmhn5af8fHWVGNGSh6mt-Aod64GDDgpAHPc6bOvGe7BUYYT9RU6GfWhY8cP-wcmdC4bE-nsS-0XeCqZbAZ9ISZNtcc1QFOrZyhhzGVXKqShT7dexUPiLM7IpRh5MPdKCB5RDdFhkTdTvvPGd5B5T0LZBQiFXNFv0j7bWU0zXoYpKwNxJDAOBDOIowoCEh1oWRxhmRzhLxiiRtj2W5tyqU3EShQTBGr4W89sNlVXAMhKCLJ1xlNi07XoUVFJwUmdRJYPEWFK_s-DnUJV9-9_BUpOAJ5fVPN9jaPSLGxXVV84iJRuYBf6uFa8GFBvmFhCS_pTYg780p04CZX9BUmcACTItfgjB3HGoYT1I7jEynxMF72c-tKpEfEzio7SE8_LNHFz1jwLo1gu4WLENQ3otNu7t8MjnAPtVbLGQk36kvQ_So5cQjtEP3CMk6XL24GZYiGFziJiC_7fEblYqT0sk5Su2SUMYqcAnLjTqO2EbJVNzqBKStWCc9OSyUpblPe7mBfsho1brpMzrHFeMcwY74QtSRzhM0jmQ4OrzJrx_sBcWCT2dvtdLrC3Zg2JbIhiE_nnRqEUAW1veH7GG8RZPqS5fECIek8_od6ghUlujtJpk9QAaSlfSay17CaBOP5mrCBGqmoSXtAMwP7k5YD2xVRTCN9n7B90h8e5LqIEx578vNy94zn7CDZWhGKCuVwsMo6r77cA'

# Dropbox folder paths
PROFILE_PICTURES_PATH = '/vigilink/profile_pictures/'
POST_IMAGES_PATH = '/vigilink/post_images/'

def get_dropbox_client():
    """Initialize and return a Dropbox client instance"""
    try:
        dbx = dropbox.Dropbox(ACCESS_TOKEN)
        # Check that the access token is valid
        dbx.users_get_current_account()
        return dbx
    except AuthError:
        print("ERROR: Invalid access token")
        return None

def upload_file_to_dropbox(file_content, file_path, overwrite=False):
    """
    Upload a file to Dropbox
    
    Args:
        file_content: The file content to upload
        file_path: The path where to store the file in Dropbox
        overwrite: Whether to overwrite an existing file
    
    Returns:
        Shared link URL if successful, None otherwise
    """
    dbx = get_dropbox_client()
    if not dbx:
        return None
    
    mode = WriteMode.overwrite if overwrite else WriteMode.add
    
    try:
        # Upload the file
        if isinstance(file_content, bytes):
            result = dbx.files_upload(file_content, file_path, mode=mode)
        else:
            # If it's a file-like object, read it first
            file_content.seek(0)
            result = dbx.files_upload(file_content.read(), file_path, mode=mode)
        
        # Create a shared link
        shared_link = dbx.sharing_create_shared_link_with_settings(file_path)
        # Convert the shared link to a direct download link
        dl_url = shared_link.url.replace('www.dropbox.com', 'dl.dropboxusercontent.com')
        dl_url = dl_url.replace('?dl=0', '')
        
        return dl_url
    except ApiError as e:
        print(f"API error: {e}")
        return None
    except Exception as e:
        print(f"Error uploading to Dropbox: {e}")
        return None

def upload_profile_picture(file, filename=None):
    """
    Upload a profile picture to Dropbox
    
    Args:
        file: The file object to upload
        filename: Optional filename, if not provided a UUID will be generated
    
    Returns:
        URL to the uploaded file if successful, None otherwise
    """
    if not filename:
        # Generate a unique filename
        ext = os.path.splitext(file.name)[1] if hasattr(file, 'name') else '.jpg'
        filename = f"{uuid.uuid4()}{ext}"
    
    file_path = f"{PROFILE_PICTURES_PATH}{filename}"
    return upload_file_to_dropbox(file, file_path)

def upload_post_image(file, filename=None):
    """
    Upload a post image to Dropbox
    
    Args:
        file: The file object to upload
        filename: Optional filename, if not provided a UUID will be generated
    
    Returns:
        URL to the uploaded file if successful, None otherwise
    """
    if not filename:
        # Generate a unique filename
        ext = os.path.splitext(file.name)[1] if hasattr(file, 'name') else '.jpg'
        filename = f"{uuid.uuid4()}{ext}"
    
    file_path = f"{POST_IMAGES_PATH}{filename}"
    return upload_file_to_dropbox(file, file_path)