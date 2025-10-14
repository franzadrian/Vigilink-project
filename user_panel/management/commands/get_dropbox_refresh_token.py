import os
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

try:
    import dropbox
except Exception as e:  # pragma: no cover
    dropbox = None


class Command(BaseCommand):
    help = (
        "Obtain a Dropbox OAuth2 refresh token (offline access) so the SDK can "
        "auto-refresh access tokens. Prints the token and can optionally save it "
        "to a file."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--save",
            action="store_true",
            help=(
                "Save the refresh token to settings.DROPBOX_REFRESH_TOKEN_FILE if set, "
                "otherwise to BASE_DIR/dropbox_refresh_token.txt"
            ),
        )
        parser.add_argument(
            "--file",
            dest="file",
            help="Explicit path to save the refresh token (overrides --save destination)",
        )
        parser.add_argument(
            "--scopes",
            nargs="*",
            help=(
                "Optional Dropbox OAuth scopes. If omitted, a recommended set is used: "
                "files.content.write/read, files.metadata.read/write, sharing.read/write, account_info.read"
            ),
        )

    def handle(self, *args, **options):
        if dropbox is None:
            raise CommandError(
                "The 'dropbox' package is not installed. Add it to requirements and pip install."
            )

        app_key = os.environ.get("DROPBOX_APP_KEY") or getattr(settings, "DROPBOX_APP_KEY", None)
        app_secret = os.environ.get("DROPBOX_APP_SECRET") or getattr(settings, "DROPBOX_APP_SECRET", None)

        # Guard against placeholders which lead to confusing 'Invalid client_id' in browser
        def _is_placeholder(s: str) -> bool:
            if not s:
                return True
            v = str(s).strip().lower()
            return v in {"your_dropbox_app_key", "your_dropbox_app_secret"}

        if (not app_key or not app_secret) or _is_placeholder(app_key) or _is_placeholder(app_secret):
            raise CommandError(
                (
                    "Missing or placeholder Dropbox app credentials.\n"
                    "- Set DROPBOX_APP_KEY and DROPBOX_APP_SECRET in your .env with real values from https://www.dropbox.com/developers/apps\n"
                    "- Current values look unset or placeholders (e.g., 'your_dropbox_app_key').\n"
                    "- After updating .env, re-run: py manage.py get_dropbox_refresh_token --save"
                )
            )

        scopes = options.get("scopes") or [
            "files.content.write",
            "files.content.read",
            "files.metadata.read",
            "files.metadata.write",
            "sharing.read",
            "sharing.write",
            "account_info.read",
        ]

        try:
            flow = dropbox.DropboxOAuth2FlowNoRedirect(
                app_key,
                app_secret,
                token_access_type="offline",
                scope=scopes,
            )
        except Exception as e:
            raise CommandError(f"Failed to initialize Dropbox OAuth flow: {e}")

        authorize_url = flow.start()
        self.stdout.write(self.style.SUCCESS("1) Open this URL and authorize the app:"))
        self.stdout.write(authorize_url)
        self.stdout.write("")
        self.stdout.write(self.style.WARNING("2) After authorizing, paste the code here:"))

        try:
            code = input("Code: ").strip()
        except Exception as e:
            raise CommandError(f"Unable to read code from stdin: {e}")

        try:
            res = flow.finish(code)
        except Exception as e:
            raise CommandError(f"Failed to exchange code for token: {e}")

        refresh_token = getattr(res, "refresh_token", None)
        if not refresh_token:
            raise CommandError(
                "No refresh token returned. Ensure token_access_type='offline' and the app has the requested scopes enabled."
            )

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("Success! Your Dropbox refresh token is:"))
        self.stdout.write(refresh_token)

        dest = options.get("file")
        if options.get("save") or dest:
            if not dest:
                dest = getattr(settings, "DROPBOX_REFRESH_TOKEN_FILE", None)
                if not dest:
                    base = getattr(settings, "BASE_DIR", Path.cwd())
                    dest = Path(base) / "dropbox_refresh_token.txt"
            dest_path = Path(dest)
            try:
                dest_path.write_text(refresh_token + "\n", encoding="utf-8")
                self.stdout.write(self.style.SUCCESS(f"Saved refresh token to: {dest_path}"))
                self.stdout.write(
                    "Set env var to use it: DROPBOX_REFRESH_TOKEN_FILE=" + str(dest_path)
                )
            except Exception as e:
                raise CommandError(f"Failed to save token to {dest_path}: {e}")

        self.stdout.write("")
        self.stdout.write(
            "Next steps:\n"
            "- Add DROPBOX_APP_KEY and DROPBOX_APP_SECRET to your .env (if not already).\n"
            "- Add either DROPBOX_REFRESH_TOKEN=<token> or DROPBOX_REFRESH_TOKEN_FILE=<file> to .env.\n"
            "- The app will auto-refresh access tokens via the refresh token."
        )
