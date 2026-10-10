package ai.sonora.speech;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.Resources;
import android.graphics.Color;
import android.graphics.Insets;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Looper;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.speech.tts.TextToSpeech;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import android.os.CancellationSignal;
import android.util.Base64;

import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.NoCredentialException;

import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

import java.util.Locale;
import java.util.concurrent.Executor;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends Activity {

    private static final int PERMISSION_REQ_CODE = 1001;
    private static final int FILE_CHOOSER_REQ_CODE = 1002;

    private static final int LOCATION_REQ_CODE = 1004;

    private WebView webView;
    private TextToSpeech tts;
    private boolean ttsReady = false;
    private boolean pendingLocation = false;
    private ValueCallback<Uri[]> filePathCallback;

    private int getSystemDimenPx(String name, int fallbackDp) {
        Resources res = getResources();
        int id = res.getIdentifier(name, "dimen", "android");
        if (id > 0) {
            return res.getDimensionPixelSize(id);
        }
        float density = res.getDisplayMetrics().density;
        return Math.round(fallbackDp * density);
    }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        if (window != null) {
            int bgColor = Color.parseColor("#F6F7FA");
            window.setStatusBarColor(bgColor);
            window.setNavigationBarColor(bgColor);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                window.getDecorView(); // decor must exist before getInsetsController() (NPE otherwise)
                WindowInsetsController controller = window.getInsetsController();
                if (controller != null) {
                    controller.setSystemBarsAppearance(
                            WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                                    | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS,
                            WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                                    | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
                    );
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                View decor = window.getDecorView();
                int flags = decor.getSystemUiVisibility() | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                }
                decor.setSystemUiVisibility(flags);
            }
        }

        try {
            tts = new TextToSpeech(this, new TextToSpeech.OnInitListener() {
                @Override
                public void onInit(int status) {
                    if (status == TextToSpeech.SUCCESS && tts != null) {
                        int res = tts.setLanguage(Locale.US);
                        if (res == TextToSpeech.LANG_MISSING_DATA || res == TextToSpeech.LANG_NOT_SUPPORTED) {
                            tts.setLanguage(Locale.ENGLISH);
                        }
                        ttsReady = true;
                    }
                }
            });
        } catch (Exception ignored) {
        }

        requestRuntimePermissionsIfNeeded();

        final int defaultTopInset = getSystemDimenPx("status_bar_height", 32);
        final int defaultBottomInset = getSystemDimenPx("navigation_bar_height", 48);

        FrameLayout rootContainer = new FrameLayout(this);
        rootContainer.setBackgroundColor(Color.parseColor("#F6F7FA"));
        rootContainer.setPadding(0, defaultTopInset, 0, defaultBottomInset);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#F6F7FA"));
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

        rootContainer.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));

        // Ensure Android 15/16 Edge-to-Edge WindowInsets + OEM ColorOS bars never overlap top or bottom UI
        rootContainer.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override
            public WindowInsets onApplyWindowInsets(View v, WindowInsets insets) {
                int left, top, right, bottom;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    // Real system bar + cutout insets, plus the keyboard so inputs are never hidden.
                    Insets bars = insets.getInsets(
                            WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout()
                    );
                    Insets ime = insets.getInsets(WindowInsets.Type.ime());
                    left = bars.left;
                    top = bars.top;
                    right = bars.right;
                    bottom = Math.max(bars.bottom, ime.bottom);
                } else {
                    left = insets.getSystemWindowInsetLeft();
                    top = Math.max(defaultTopInset, insets.getSystemWindowInsetTop());
                    right = insets.getSystemWindowInsetRight();
                    bottom = insets.getSystemWindowInsetBottom();
                }
                v.setPadding(left, top, right, bottom);
                return insets;
            }
        });

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setGeolocationEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        settings.setTextZoom(100);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        webView.addJavascriptInterface(new SonoraNativeBridge(this), "SonoraNative");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme() != null ? uri.getScheme().toLowerCase() : "";
                if ("tel".equals(scheme) || "mailto".equals(scheme) || "geo".equals(scheme)) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                        startActivity(intent);
                    } catch (Exception ignored) {
                    }
                    return true;
                }
                // Never intercept subframe (iframe) loads such as embedded Google Maps
                if (!request.isForMainFrame()) {
                    return false;
                }
                if (("http".equals(scheme) || "https".equals(scheme))
                        && (uri.toString().contains("github.com")
                        || uri.toString().contains("maps.google.com")
                        || uri.toString().contains("google.com/maps"))) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                        startActivity(intent);
                    } catch (Exception ignored) {
                    }
                    return true;
                }
                return false;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        request.grant(request.getResources());
                    }
                });
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                callback.invoke(origin, true, false);
            }

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                }
                MainActivity.this.filePathCallback = filePathCallback;
                try {
                    Intent intent = fileChooserParams.createIntent();
                    startActivityForResult(intent, FILE_CHOOSER_REQ_CODE);
                } catch (Exception e) {
                    MainActivity.this.filePathCallback = null;
                    return false;
                }
                return true;
            }
        });

        setContentView(rootContainer);
        rootContainer.requestApplyInsets();
        webView.clearCache(true);
        webView.loadUrl("file:///android_asset/sonora_app.html");
    }

    private void requestRuntimePermissionsIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            String[] perms = new String[]{
                    Manifest.permission.RECORD_AUDIO,
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
            };
            List<String> needed = new ArrayList<>();
            for (String p : perms) {
                if (checkSelfPermission(p) != PackageManager.PERMISSION_GRANTED) {
                    needed.add(p);
                }
            }
            if (!needed.isEmpty()) {
                requestPermissions(needed.toArray(new String[0]), PERMISSION_REQ_CODE);
            }
        }
    }

    // OAuth "Web client" ID from google-services.json (client_type 3). Firebase accepts ID tokens issued for it.
    private static final String GOOGLE_WEB_CLIENT_ID =
            "84888531802-7hhdtg5hvn2r72prhv4gdsbovivkf04j.apps.googleusercontent.com";

    private void jsCall(final String fn, final String... args) {
        if (webView == null) return;
        StringBuilder sb = new StringBuilder("window.").append(fn).append(" && window.").append(fn).append("(");
        for (int i = 0; i < args.length; i++) {
            if (i > 0) sb.append(",");
            sb.append(JSONObject.quote(args[i] == null ? "" : args[i]));
        }
        sb.append(");");
        final String js = sb.toString();
        webView.post(new Runnable() {
            @Override
            public void run() {
                webView.evaluateJavascript(js, null);
            }
        });
    }

    private void startGoogleSignIn() {
        CredentialManager cm = CredentialManager.create(this);
        GetSignInWithGoogleOption option = new GetSignInWithGoogleOption.Builder(GOOGLE_WEB_CLIENT_ID).build();
        GetCredentialRequest request = new GetCredentialRequest.Builder().addCredentialOption(option).build();
        Executor mainExecutor = new Executor() {
            @Override
            public void execute(Runnable r) {
                runOnUiThread(r);
            }
        };
        cm.getCredentialAsync(this, request, new CancellationSignal(), mainExecutor,
                new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                    @Override
                    public void onResult(GetCredentialResponse response) {
                        Credential credential = response.getCredential();
                        if (credential instanceof CustomCredential
                                && GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())) {
                            try {
                                GoogleIdTokenCredential g = GoogleIdTokenCredential.createFrom(credential.getData());
                                jsCall("onNativeGoogleSignIn",
                                        g.getIdToken(),
                                        g.getId(),
                                        g.getDisplayName(),
                                        g.getProfilePictureUri() != null ? g.getProfilePictureUri().toString() : "");
                            } catch (Exception e) {
                                jsCall("onNativeGoogleSignInError", "Couldn't read the Google account.");
                            }
                        } else {
                            jsCall("onNativeGoogleSignInError", "Unexpected sign-in response.");
                        }
                    }

                    @Override
                    public void onError(GetCredentialException e) {
                        if (e instanceof GetCredentialCancellationException) {
                            jsCall("onNativeGoogleSignInError", "");
                        } else if (e instanceof NoCredentialException) {
                            jsCall("onNativeGoogleSignInError", "No Google account found on this phone.");
                        } else {
                            String msg = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
                            jsCall("onNativeGoogleSignInError", "Google sign-in failed: " + msg);
                        }
                    }
                });
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == LOCATION_REQ_CODE && pendingLocation) {
            pendingLocation = false;
            boolean granted = false;
            for (int r : grantResults) if (r == PackageManager.PERMISSION_GRANTED) granted = true;
            if (granted) fetchLocation();
            else sendLocationError("Location permission is off.");
        }
    }

    private void sendLocationError(final String msg) {
        if (webView == null) return;
        final String safe = msg.replace("\\", "\\\\").replace("'", "\\'");
        webView.post(new Runnable() {
            @Override
            public void run() {
                webView.evaluateJavascript("window.onNativeLocationError && window.onNativeLocationError('" + safe + "');", null);
            }
        });
    }

    private void sendLocation(final Location loc) {
        if (webView == null || loc == null) return;
        webView.post(new Runnable() {
            @Override
            public void run() {
                webView.evaluateJavascript("window.onNativeLocation && window.onNativeLocation("
                        + loc.getLatitude() + "," + loc.getLongitude() + ");", null);
            }
        });
    }

    @SuppressWarnings({"MissingPermission", "deprecation"})
    private void fetchLocation() {
        final LocationManager lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        if (lm == null) {
            sendLocationError("fallback");
            return;
        }
        Location best = null;
        try {
            for (String provider : lm.getProviders(true)) {
                Location l = lm.getLastKnownLocation(provider);
                if (l != null && (best == null || l.getTime() > best.getTime())) best = l;
            }
        } catch (SecurityException ignored) {
        }
        if (best != null && System.currentTimeMillis() - best.getTime() < 30L * 60L * 1000L) {
            sendLocation(best);
            return;
        }
        String provider = null;
        if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) provider = LocationManager.NETWORK_PROVIDER;
        else if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) provider = LocationManager.GPS_PROVIDER;
        if (provider == null) {
            if (best != null) sendLocation(best);
            else sendLocationError("Turn on location in your phone settings.");
            return;
        }
        final Location fallback = best;
        final boolean[] done = {false};
        final LocationListener listener = new LocationListener() {
            @Override
            public void onLocationChanged(Location location) {
                if (done[0]) return;
                done[0] = true;
                sendLocation(location);
            }
            @Override public void onStatusChanged(String p, int s, Bundle b) { }
            @Override public void onProviderEnabled(String p) { }
            @Override public void onProviderDisabled(String p) { }
        };
        try {
            lm.requestSingleUpdate(provider, listener, Looper.getMainLooper());
        } catch (SecurityException e) {
            sendLocationError("Location permission is off.");
            return;
        }
        webView.postDelayed(new Runnable() {
            @Override
            public void run() {
                if (done[0]) return;
                done[0] = true;
                try { lm.removeUpdates(listener); } catch (Exception ignored) { }
                if (fallback != null) sendLocation(fallback);
                else sendLocationError("Couldn't get your location. Try again outdoors.");
            }
        }, 15000);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_REQ_CODE) {
            if (filePathCallback != null) {
                Uri[] results = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
                filePathCallback.onReceiveValue(results);
                filePathCallback = null;
            }
        } else {
            super.onActivityResult(requestCode, resultCode, data);
        }
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        if (webView == null) {
            super.onBackPressed();
            return;
        }
        webView.evaluateJavascript("(window.onNativeBack && window.onNativeBack()) ? 'handled' : 'exit'",
                new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String value) {
                        if (value == null || !value.contains("handled")) {
                            finish();
                        }
                    }
                });
    }

    public class SonoraNativeBridge {
        private final Context context;

        public SonoraNativeBridge(Context context) {
            this.context = context;
        }

        @JavascriptInterface
        public void hapticTick(int durationMs) {
            try {
                Vibrator v = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
                if (v != null && v.hasVibrator()) {
                    int d = Math.max(10, Math.min(durationMs, 300));
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        v.vibrate(VibrationEffect.createOneShot(d, VibrationEffect.DEFAULT_AMPLITUDE));
                    } else {
                        v.vibrate(d);
                    }
                }
            } catch (Exception ignored) {
            }
        }

        /** Google's native "Sign in with Google" sheet (Credential Manager). Result goes to JS. */
        @JavascriptInterface
        public void signInWithGoogle() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    startGoogleSignIn();
                }
            });
        }

        @JavascriptInterface
        public void shareReport(final String title, final String summaryText) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Intent sendIntent = new Intent(Intent.ACTION_SEND);
                    sendIntent.setType("text/plain");
                    sendIntent.putExtra(Intent.EXTRA_SUBJECT, title);
                    sendIntent.putExtra(Intent.EXTRA_TEXT, summaryText);
                    Intent shareIntent = Intent.createChooser(sendIntent, "Share Sonora Clinical Report");
                    startActivity(shareIntent);
                }
            });
        }

        @JavascriptInterface
        public void printClinicalReport(final String jobName) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                        if (printManager != null && webView != null) {
                            String name = (jobName != null && !jobName.isEmpty()) ? jobName : "Sonora_Clinical_Report";
                            PrintDocumentAdapter adapter = webView.createPrintDocumentAdapter(name);
                            printManager.print(name, adapter, new PrintAttributes.Builder().build());
                        }
                    } catch (Exception e) {
                        Toast.makeText(context, "Unable to open PDF print spooler", Toast.LENGTH_SHORT).show();
                    }
                }
            });
        }

        @JavascriptInterface
        public void openExternalUrl(final String url) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        startActivity(intent);
                    } catch (Exception ignored) {
                    }
                }
            });
        }

        @JavascriptInterface
        public void copyToClipboard(final String label, final String text) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    ClipboardManager cb = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                    if (cb != null) {
                        cb.setPrimaryClip(ClipData.newPlainText(label, text));
                        Toast.makeText(context, "Copied to clipboard", Toast.LENGTH_SHORT).show();
                    }
                }
            });
        }

        @SuppressWarnings({"MissingPermission", "deprecation"})
        @JavascriptInterface
        public void requestLocation() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                            && checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED
                            && checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                        pendingLocation = true;
                        requestPermissions(new String[]{
                                Manifest.permission.ACCESS_FINE_LOCATION,
                                Manifest.permission.ACCESS_COARSE_LOCATION
                        }, LOCATION_REQ_CODE);
                        return;
                    }
                    fetchLocation();
                }
            });
        }

        /** Plain HTTP for the page (avoids CORS limits on file:// pages). Result goes to window.onNativeHttp. */
        @JavascriptInterface
        public void http(final String id, final String method, final String url, final String contentType,
                         final String bodyBase64, final int timeoutMs) {
            new Thread(new Runnable() {
                @Override
                public void run() {
                    int status = -1;
                    String text = "";
                    HttpURLConnection conn = null;
                    try {
                        conn = (HttpURLConnection) new URL(url).openConnection();
                        conn.setRequestMethod(method);
                        conn.setConnectTimeout(Math.min(timeoutMs, 20000));
                        conn.setReadTimeout(Math.max(timeoutMs, 5000));
                        conn.setUseCaches(false);
                        if (bodyBase64 != null && !bodyBase64.isEmpty()) {
                            byte[] body = Base64.decode(bodyBase64, Base64.DEFAULT);
                            conn.setDoOutput(true);
                            if (contentType != null && !contentType.isEmpty()) {
                                conn.setRequestProperty("Content-Type", contentType);
                            }
                            conn.setFixedLengthStreamingMode(body.length);
                            OutputStream os = conn.getOutputStream();
                            os.write(body);
                            os.close();
                        }
                        status = conn.getResponseCode();
                        InputStream is = status >= 400 ? conn.getErrorStream() : conn.getInputStream();
                        if (is != null) {
                            ByteArrayOutputStream bos = new ByteArrayOutputStream();
                            byte[] buf = new byte[8192];
                            int n;
                            while ((n = is.read(buf)) != -1) bos.write(buf, 0, n);
                            is.close();
                            text = bos.toString("UTF-8");
                        }
                    } catch (Exception e) {
                        status = -1;
                        text = String.valueOf(e.getMessage());
                    } finally {
                        if (conn != null) conn.disconnect();
                    }
                    final String js = "window.onNativeHttp && window.onNativeHttp(" + JSONObject.quote(id) + ","
                            + status + "," + JSONObject.quote(text) + ");";
                    webView.post(new Runnable() {
                        @Override
                        public void run() {
                            webView.evaluateJavascript(js, null);
                        }
                    });
                }
            }).start();
        }

        @JavascriptInterface
        public void speakText(final String text, final float rate) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        if (tts != null && ttsReady && text != null && !text.isEmpty()) {
                            float safeRate = Math.max(0.5f, Math.min(1.5f, rate > 0 ? rate : 0.85f));
                            tts.setSpeechRate(safeRate);
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                                tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "sonora_tts_" + System.currentTimeMillis());
                            } else {
                                tts.speak(text, TextToSpeech.QUEUE_FLUSH, null);
                            }
                        }
                    } catch (Exception ignored) {
                    }
                }
            });
        }

        @JavascriptInterface
        public void showToast(final String message) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Toast.makeText(context, message, Toast.LENGTH_SHORT).show();
                }
            });
        }
    }

    @Override
    protected void onDestroy() {
        if (tts != null) {
            try {
                tts.stop();
                tts.shutdown();
            } catch (Exception ignored) {
            }
            tts = null;
        }
        super.onDestroy();
    }
}
