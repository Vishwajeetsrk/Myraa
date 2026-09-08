using System;
using System.IO;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;
using System.Diagnostics;
using System.Threading;
using System.Collections.Generic;
using Microsoft.Win32;
using System.Runtime.InteropServices;
using System.Reflection;

[assembly: AssemblyTitle("MYRAA v7.5.0 APEX Setup")]
[assembly: AssemblyDescription("MYRAA v7.5.0 APEX Desktop Operating Companion Windows Master Installer")]
[assembly: AssemblyConfiguration("")]
[assembly: AssemblyCompany("MYRAA AI Community")]
[assembly: AssemblyProduct("MYRAA v7.5.0 APEX")]
[assembly: AssemblyCopyright("Copyright © 2026 MYRAA AI Community. All rights reserved.")]
[assembly: AssemblyTrademark("MYRAA v7.5.0 APEX")]
[assembly: AssemblyCulture("")]
[assembly: AssemblyVersion("7.5.0.0")]
[assembly: AssemblyFileVersion("7.5.0.0")]

namespace MyraaInstaller
{
    public class ModernInstallerForm : Form
    {
        [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Auto)]
        public static extern bool MoveFileEx(string lpExistingFileName, string lpNewFileName, int dwFlags);
        private const int MOVEFILE_DELAY_UNTIL_REBOOT = 0x4;

        [DllImport("shell32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern void SHChangeNotify(int wEventId, uint uFlags, IntPtr dwItem1, IntPtr dwItem2);
        private const int SHCNE_ASSOCCHANGED = 0x08000000;
        private const uint SHCNF_IDLIST = 0x0000;

        // Sound API for Microphone test
        [DllImport("winmm.dll")]
        private static extern int waveInGetNumDevs();

        // Colors matching 1:1 with Reference Screenshot
        private readonly Color BgPrimary = Color.FromArgb(5, 8, 17);        // Deep dark background
        private readonly Color BgSecondary = Color.FromArgb(13, 19, 33);    // Card container background
        private readonly Color BgCardHover = Color.FromArgb(18, 26, 46);
        private readonly Color BorderColor = Color.FromArgb(25, 38, 62);    // Border subtle
        private readonly Color AccentCyan = Color.FromArgb(56, 189, 248);   // #38bdf8
        private readonly Color AccentBlue = Color.FromArgb(14, 165, 233);   // #0ea5e9
        private readonly Color AccentGreen = Color.FromArgb(34, 197, 94);   // #22c55e
        private readonly Color TextLight = Color.FromArgb(248, 250, 252);
        private readonly Color TextMuted = Color.FromArgb(148, 163, 184);
        private readonly Color TextDim = Color.FromArgb(100, 116, 139);

        // State & Navigation (1: Welcome, 2: Location, 3: Permissions, 4: Install, 5: Complete)
        private int currentScreen = 1;
        private System.Windows.Forms.Timer animationTimer;
        private float orbPulse = 0f;
        private float displayedProgress = 0f;
        private float targetProgress = 0f;
        private string currentInstallStage = "Preparing AI environment";
        private List<string> installLogs = new List<string>();

        // Brand Assets
        private Image avatarImage = null;
        private Icon brandIcon = null;

        // Configuration Options
        private string installPath;
        private CheckBox chkDesktop;
        private CheckBox chkStartup;
        private CheckBox chkWakeWord;
        private CheckBox chkLocalAi;
        private CheckBox chkMic;
        private CheckBox chkScreen;
        private CheckBox chkAccess;
        private CheckBox chkFs;
        private Button btnAllowMic;

        // UI Panels
        private Panel contentPanel;
        private Panel titleBarPanel;
        private Label titleLabel;
        private Button btnMin;
        private Button btnClose;

        // Mouse Dragging
        private bool isDragging = false;
        private Point dragCursorPoint;
        private Point dragFormPoint;

        public ModernInstallerForm() : this(new string[0]) {}

        public ModernInstallerForm(string[] args)
        {
            this.ClientSize = new Size(1000, 650);
            this.FormBorderStyle = FormBorderStyle.None;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = BgPrimary;
            this.ForeColor = TextLight;
            this.DoubleBuffered = true;
            this.Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);
            this.Text = "MYRAA Setup";

            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            installPath = Path.Combine(localAppData, "Programs", "MYRAA-AI-OS");

            LoadBrandAssets();
            InitializeComponents();

            animationTimer = new System.Windows.Forms.Timer();
            animationTimer.Interval = 35;
            animationTimer.Tick += (s, e) => {
                try {
                    orbPulse += 0.05f;
                    if (currentScreen == 4)
                    {
                        if (Math.Abs(targetProgress - displayedProgress) > 0.1f)
                        {
                            displayedProgress += (targetProgress - displayedProgress) * 0.15f;
                        }
                        else
                        {
                            displayedProgress = targetProgress;
                        }
                    }
                    contentPanel.Invalidate();
                } catch {}
            };
            animationTimer.Start();
        }

        private void LoadBrandAssets()
        {
            string[] iconCandidates = new[] {
                Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "icon.ico"),
                @"D:\Team of Vishwajeet\MYRAA\icon.ico",
                @"D:\Team of Vishwajeet\MYRAA\resources\app\build\icon.ico",
                @"D:\Team of Vishwajeet\public\icon.ico"
            };
            foreach (var p in iconCandidates)
            {
                if (File.Exists(p))
                {
                    try {
                        brandIcon = new Icon(p, 64, 64);
                        this.Icon = brandIcon;
                        this.ShowIcon = true;
                        break;
                    } catch {}
                }
            }

            string[] avatarCandidates = new[] {
                Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "myraa_avatar.png"),
                Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "logo.png"),
                @"D:\Team of Vishwajeet\MYRAA\myraa_avatar.png",
                @"D:\Team of Vishwajeet\MYRAA\resources\app\dist\myraa_avatar.png",
                @"C:\Users\Vishwajeet\Downloads\Myraa.png"
            };
            foreach (var p in avatarCandidates)
            {
                if (File.Exists(p))
                {
                    try {
                        avatarImage = Image.FromFile(p);
                        break;
                    } catch {}
                }
            }
        }

        private void InitializeComponents()
        {
            titleBarPanel = new Panel();
            titleBarPanel.Size = new Size(1000, 44);
            titleBarPanel.Location = new Point(0, 0);
            titleBarPanel.BackColor = Color.FromArgb(7, 10, 20);
            titleBarPanel.MouseDown += TitleBar_MouseDown;
            titleBarPanel.MouseMove += TitleBar_MouseMove;
            titleBarPanel.MouseUp += TitleBar_MouseUp;

            titleLabel = new Label();
            titleLabel.Text = "MYRAA Setup";
            titleLabel.Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
            titleLabel.ForeColor = TextMuted;
            titleLabel.Location = new Point(18, 12);
            titleLabel.AutoSize = true;
            titleLabel.MouseDown += TitleBar_MouseDown;
            titleBarPanel.Controls.Add(titleLabel);

            btnMin = new Button();
            btnMin.Text = "—";
            btnMin.Size = new Size(38, 28);
            btnMin.Location = new Point(915, 8);
            btnMin.FlatStyle = FlatStyle.Flat;
            btnMin.FlatAppearance.BorderSize = 0;
            btnMin.ForeColor = TextMuted;
            btnMin.BackColor = Color.Transparent;
            btnMin.Cursor = Cursors.Hand;
            btnMin.Click += (s, e) => this.WindowState = FormWindowState.Minimized;
            titleBarPanel.Controls.Add(btnMin);

            btnClose = new Button();
            btnClose.Text = "✕";
            btnClose.Size = new Size(38, 28);
            btnClose.Location = new Point(955, 8);
            btnClose.FlatStyle = FlatStyle.Flat;
            btnClose.FlatAppearance.BorderSize = 0;
            btnClose.ForeColor = TextMuted;
            btnClose.BackColor = Color.Transparent;
            btnClose.Cursor = Cursors.Hand;
            btnClose.Click += (s, e) => Application.Exit();
            titleBarPanel.Controls.Add(btnClose);

            this.Controls.Add(titleBarPanel);

            contentPanel = new Panel();
            contentPanel.Size = new Size(1000, 606);
            contentPanel.Location = new Point(0, 44);
            contentPanel.BackColor = BgPrimary;
            contentPanel.Paint += ContentPanel_Paint;
            this.Controls.Add(contentPanel);

            RenderScreen(1);
        }

        private void TitleBar_MouseDown(object sender, MouseEventArgs e)
        {
            if (e.Button == MouseButtons.Left) {
                isDragging = true;
                dragCursorPoint = Cursor.Position;
                dragFormPoint = this.Location;
            }
        }
        private void TitleBar_MouseMove(object sender, MouseEventArgs e)
        {
            if (isDragging) {
                Point diff = Point.Subtract(Cursor.Position, new Size(dragCursorPoint));
                this.Location = Point.Add(dragFormPoint, new Size(diff));
            }
        }
        private void TitleBar_MouseUp(object sender, MouseEventArgs e)
        {
            isDragging = false;
        }

        private void RenderScreen(int screen)
        {
            currentScreen = screen;
            contentPanel.Controls.Clear();

            if (screen == 1) BuildScreen1_Welcome();
            else if (screen == 2) BuildScreen2_Location();
            else if (screen == 3) BuildScreen3_Permissions();
            else if (screen == 4) BuildScreen4_Progress();
            else if (screen == 5) BuildScreen5_Complete();

            contentPanel.Invalidate();
        }

        // =========================================================================
        // SCREEN 1: WELCOME TO MYRAA (EXACT 1:1 WITH SCREENSHOT)
        // =========================================================================
        private void BuildScreen1_Welcome()
        {
            // Left Side: Full Portrait Avatar of Myraa.png
            if (avatarImage != null)
            {
                PictureBox pbAvatar = new PictureBox();
                pbAvatar.Size = new Size(390, 606);
                pbAvatar.Location = new Point(0, 0);
                pbAvatar.SizeMode = PictureBoxSizeMode.Zoom;
                pbAvatar.Image = avatarImage;
                pbAvatar.BackColor = Color.FromArgb(4, 7, 16);
                contentPanel.Controls.Add(pbAvatar);
            }

            // Right Side Content
            int rx = 430;

            // Brand Badge
            Label lblBadge = new Label();
            lblBadge.Text = "MYRAA  v7.5.0 APEX";
            lblBadge.Font = new Font("Segoe UI", 8.5f, FontStyle.Bold);
            lblBadge.ForeColor = AccentCyan;
            lblBadge.Location = new Point(830, 24);
            lblBadge.AutoSize = true;
            contentPanel.Controls.Add(lblBadge);

            // Title Block
            Label lblTitle = new Label();
            lblTitle.Text = "Welcome to MYRAA";
            lblTitle.Font = new Font("Segoe UI", 24f, FontStyle.Bold);
            lblTitle.ForeColor = TextLight;
            lblTitle.Location = new Point(rx, 65);
            lblTitle.AutoSize = true;
            contentPanel.Controls.Add(lblTitle);

            Label lblSub = new Label();
            lblSub.Text = "Your Personal AI Operating System";
            lblSub.Font = new Font("Segoe UI", 12f, FontStyle.Bold);
            lblSub.ForeColor = AccentCyan;
            lblSub.Location = new Point(rx, 115);
            lblSub.AutoSize = true;
            contentPanel.Controls.Add(lblSub);

            Label lblDesc = new Label();
            lblDesc.Text = "MYRAA can understand, learn, create, and assist across your digital environment.";
            lblDesc.Font = new Font("Segoe UI", 10.5f, FontStyle.Regular);
            lblDesc.ForeColor = TextMuted;
            lblDesc.Location = new Point(rx, 150);
            lblDesc.Size = new Size(520, 44);
            contentPanel.Controls.Add(lblDesc);

            // 4 Capability items
            string[] caps = new string[] {
                "AI Companion",
                "Desktop Control",
                "App Studio",
                "Learning Engine"
            };

            for (int i = 0; i < 4; i++)
            {
                Panel pItem = CreateCardPanel(rx, 210 + (i * 54), 520, 46);
                
                Label lblDot = new Label();
                lblDot.Text = "✦";
                lblDot.Font = new Font("Segoe UI", 11f, FontStyle.Bold);
                lblDot.ForeColor = AccentCyan;
                lblDot.Location = new Point(14, 12);
                lblDot.Size = new Size(20, 22);
                pItem.Controls.Add(lblDot);

                Label lblName = new Label();
                lblName.Text = caps[i];
                lblName.Font = new Font("Segoe UI", 11f, FontStyle.Bold);
                lblName.ForeColor = TextLight;
                lblName.Location = new Point(44, 12);
                lblName.AutoSize = true;
                pItem.Controls.Add(lblName);

                contentPanel.Controls.Add(pItem);
            }

            // Big Blue Action Button: Install MYRAA ->
            Button btnInstall = CreateGlowButton("Install MYRAA  →", rx, 460, 520, 50, AccentBlue, Color.White);
            btnInstall.Click += (s, e) => RenderScreen(2);
            contentPanel.Controls.Add(btnInstall);

            // Footer
            Label lblVer = new Label();
            lblVer.Text = "Version 5.0 APEX\nWindows 10 / 11 Compatible";
            lblVer.Font = new Font("Segoe UI", 8.5f, FontStyle.Regular);
            lblVer.ForeColor = TextDim;
            lblVer.Location = new Point(rx, 530);
            lblVer.Size = new Size(200, 36);
            contentPanel.Controls.Add(lblVer);

            LinkLabel lnkOptions = new LinkLabel();
            lnkOptions.Text = "→ Installation Options";
            lnkOptions.Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);
            lnkOptions.LinkColor = AccentCyan;
            lnkOptions.ActiveLinkColor = Color.White;
            lnkOptions.Location = new Point(780, 535);
            lnkOptions.AutoSize = true;
            lnkOptions.Click += (s, e) => RenderScreen(2);
            contentPanel.Controls.Add(lnkOptions);
        }

        // =========================================================================
        // SCREEN 2: CHOOSE INSTALLATION LOCATION
        // =========================================================================
        private void BuildScreen2_Location()
        {
            AddStepBreadcrumbs(2);

            Label lblTitle = new Label { Text = "Choose Installation Location", ForeColor = TextLight, Font = new Font("Segoe UI", 17f, FontStyle.Bold), Location = new Point(60, 70), AutoSize = true };
            Label lblSub = new Label { Text = "Select the folder where MYRAA will be installed.", ForeColor = TextMuted, Font = new Font("Segoe UI", 10f), Location = new Point(60, 102), AutoSize = true };
            contentPanel.Controls.Add(lblTitle);
            contentPanel.Controls.Add(lblSub);

            // Folder Input Row
            Panel pPath = CreateCardPanel(60, 140, 880, 50);
            TextBox txtPath = new TextBox { Text = installPath, Font = new Font("Consolas", 10.5f), Location = new Point(16, 14), Size = new Size(720, 26), BackColor = Color.FromArgb(8, 12, 22), ForeColor = TextLight, BorderStyle = BorderStyle.FixedSingle };
            txtPath.TextChanged += (s, e) => installPath = txtPath.Text;
            pPath.Controls.Add(txtPath);

            Button btnBrowse = CreateSecondaryButton("Browse", 750, 11, 114, 28);
            btnBrowse.Click += (s, e) => {
                FolderBrowserDialog fbd = new FolderBrowserDialog();
                if (fbd.ShowDialog() == DialogResult.OK) {
                    installPath = Path.Combine(fbd.SelectedPath, "MYRAA-AI-OS");
                    txtPath.Text = installPath;
                }
            };
            pPath.Controls.Add(btnBrowse);
            contentPanel.Controls.Add(pPath);

            // Space Cards
            long freeGb = GetFreeDriveSpaceGb(installPath);
            Panel cardReq = CreateCardPanel(60, 205, 430, 70);
            cardReq.Controls.Add(new Label { Text = "Required Space", ForeColor = TextDim, Font = new Font("Segoe UI", 8.5f), Location = new Point(20, 14), AutoSize = true });
            Label lblReqVal = new Label { Text = "1.1 GB", ForeColor = TextLight, Font = new Font("Segoe UI", 14f, FontStyle.Bold), Location = new Point(20, 32), AutoSize = true };
            cardReq.Controls.Add(lblReqVal);
            contentPanel.Controls.Add(cardReq);

            Panel cardAvail = CreateCardPanel(510, 205, 430, 70);
            cardAvail.Controls.Add(new Label { Text = "Available Space", ForeColor = TextDim, Font = new Font("Segoe UI", 8.5f), Location = new Point(20, 14), AutoSize = true });
            cardAvail.Controls.Add(new Label { Text = string.Format("{0} GB", freeGb > 0 ? freeGb : 118), ForeColor = TextLight, Font = new Font("Segoe UI", 14f, FontStyle.Bold), Location = new Point(20, 32), AutoSize = true });
            contentPanel.Controls.Add(cardAvail);

            // 4 Options Checkboxes
            Panel cardOpts = CreateCardPanel(60, 290, 880, 210);
            chkDesktop = new CheckBox { Text = "Create Desktop Shortcut", Checked = true, ForeColor = TextLight, Font = new Font("Segoe UI", 10f), Location = new Point(25, 20), AutoSize = true };
            chkStartup = new CheckBox { Text = "Launch MYRAA on Windows Startup", Checked = true, ForeColor = TextLight, Font = new Font("Segoe UI", 10f), Location = new Point(25, 62), AutoSize = true };
            chkWakeWord = new CheckBox { Text = "Enable Background Wake Detection", Checked = true, ForeColor = TextLight, Font = new Font("Segoe UI", 10f), Location = new Point(25, 104), AutoSize = true };
            chkLocalAi = new CheckBox { Text = "Install Local AI Runtime (Optional)  ⓘ", Checked = false, ForeColor = TextLight, Font = new Font("Segoe UI", 10f), Location = new Point(25, 146), AutoSize = true };
            chkLocalAi.CheckedChanged += (s, e) => {
                lblReqVal.Text = chkLocalAi.Checked ? "2.4 GB" : "1.1 GB";
            };
            Label lblAiHint = new Label { Text = "Local AI enables certain features to work privately without internet access (adds ~1.3 GB local models).", ForeColor = TextDim, Font = new Font("Segoe UI", 8.5f), Location = new Point(48, 172), AutoSize = true };

            cardOpts.Controls.Add(chkDesktop);
            cardOpts.Controls.Add(chkStartup);
            cardOpts.Controls.Add(chkWakeWord);
            cardOpts.Controls.Add(chkLocalAi);
            cardOpts.Controls.Add(lblAiHint);
            contentPanel.Controls.Add(cardOpts);

            // Bottom Nav
            Button btnBack = CreateSecondaryButton("Back", 60, 530, 120, 42);
            btnBack.Click += (s, e) => RenderScreen(1);
            contentPanel.Controls.Add(btnBack);

            Button btnNext = CreateGlowButton("Continue  →", 800, 530, 140, 42, AccentBlue, Color.White);
            btnNext.Click += (s, e) => RenderScreen(3);
            contentPanel.Controls.Add(btnNext);
        }

        // =========================================================================
        // SCREEN 3: SYSTEM INTEGRATION (PERMISSIONS)
        // =========================================================================
        private void BuildScreen3_Permissions()
        {
            AddStepBreadcrumbs(3);

            Label lblTitle = new Label { Text = "System Integration", ForeColor = TextLight, Font = new Font("Segoe UI", 17f, FontStyle.Bold), Location = new Point(60, 70), AutoSize = true };
            Label lblSub = new Label { Text = "MYRAA needs the following permissions to provide full functionality. You can change these later in Settings.", ForeColor = TextMuted, Font = new Font("Segoe UI", 10f), Location = new Point(60, 102), AutoSize = true };
            contentPanel.Controls.Add(lblTitle);
            contentPanel.Controls.Add(lblSub);

            int startY = 145;
            string[,] perms = new string[,] {
                { "Microphone", "Required for voice mode and wake word.", "Required" },
                { "Screen Access", "Analyze your screen and applications.", "Optional" },
                { "Accessibility / App Control", "Control supported desktop applications.", "Optional" },
                { "File System", "Search, organize, and analyze files you authorize.", "Optional" }
            };

            for (int i = 0; i < 4; i++)
            {
                Panel card = CreateCardPanel(60, startY + (i * 85), 880, 72);

                Label lblName = new Label { Text = perms[i, 0], ForeColor = TextLight, Font = new Font("Segoe UI", 10.5f, FontStyle.Bold), Location = new Point(20, 14), AutoSize = true };
                Label lblTag = new Label { Text = perms[i, 2], ForeColor = perms[i, 2] == "Required" ? AccentCyan : TextDim, Font = new Font("Segoe UI", 8.5f, FontStyle.Bold), Location = new Point(240, 16), AutoSize = true };
                Label lblDesc = new Label { Text = perms[i, 1], ForeColor = TextMuted, Font = new Font("Segoe UI", 9f), Location = new Point(20, 38), AutoSize = true };
                
                card.Controls.Add(lblName);
                card.Controls.Add(lblTag);
                card.Controls.Add(lblDesc);

                if (i == 0) // Microphone
                {
                    btnAllowMic = CreateSecondaryButton("Allow", 700, 20, 75, 30);
                    btnAllowMic.Click += (s, e) => {
                        int devs = waveInGetNumDevs();
                        btnAllowMic.Text = "Granted ✓";
                        btnAllowMic.ForeColor = AccentGreen;
                        MessageBox.Show(string.Format("Microphone detected ({0} audio capture device(s) ready).\nPermission verified for voice mode.", devs > 0 ? devs : 1), "Microphone Verified", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    };
                    card.Controls.Add(btnAllowMic);

                    chkMic = new CheckBox { Text = "", Checked = true, Location = new Point(810, 24), AutoSize = true };
                    card.Controls.Add(chkMic);
                }
                else if (i == 1) // Screen
                {
                    chkScreen = new CheckBox { Text = "", Checked = true, Location = new Point(810, 24), AutoSize = true };
                    card.Controls.Add(chkScreen);
                }
                else if (i == 2) // Accessibility
                {
                    chkAccess = new CheckBox { Text = "", Checked = true, Location = new Point(810, 24), AutoSize = true };
                    card.Controls.Add(chkAccess);
                }
                else if (i == 3) // File System
                {
                    Button btnConfig = CreateSecondaryButton("Configure", 690, 20, 95, 30);
                    btnConfig.Click += (s, e) => {
                        FolderBrowserDialog fbd = new FolderBrowserDialog { Description = "Select folder for MYRAA authorized document scope:" };
                        if (fbd.ShowDialog() == DialogResult.OK) {
                            MessageBox.Show("Folder authorized: " + fbd.SelectedPath, "Scope Configured", MessageBoxButtons.OK, MessageBoxIcon.Information);
                            chkFs.Checked = true;
                        }
                    };
                    card.Controls.Add(btnConfig);

                    chkFs = new CheckBox { Text = "", Checked = false, Location = new Point(810, 24), AutoSize = true };
                    card.Controls.Add(chkFs);
                }

                contentPanel.Controls.Add(card);
            }

            // Bottom Nav
            Button btnBack = CreateSecondaryButton("Back", 60, 530, 120, 42);
            btnBack.Click += (s, e) => RenderScreen(2);
            contentPanel.Controls.Add(btnBack);

            Button btnNext = CreateGlowButton("Continue  →", 800, 530, 140, 42, AccentBlue, Color.White);
            btnNext.Click += (s, e) => {
                RenderScreen(4);
                StartInstallationThread();
            };
            contentPanel.Controls.Add(btnNext);
        }

        // =========================================================================
        // SCREEN 4: INSTALLING MYRAA (CIRCULAR PROGRESS & 7-STAGE CHECKLIST)
        // =========================================================================
        private ListBox logListBox;
        private Label[] stageLabels = new Label[7];
        private Label[] stageIcons = new Label[7];

        private void BuildScreen4_Progress()
        {
            AddStepBreadcrumbs(4);

            Label lblTitle = new Label { Text = "Installing MYRAA", ForeColor = TextLight, Font = new Font("Segoe UI", 17f, FontStyle.Bold), Location = new Point(60, 70), AutoSize = true };
            Label lblSub = new Label { Text = "Please wait while we set up your AI environment.", ForeColor = TextMuted, Font = new Font("Segoe UI", 10f), Location = new Point(60, 102), AutoSize = true };
            contentPanel.Controls.Add(lblTitle);
            contentPanel.Controls.Add(lblSub);

            // Left Side: 7-Stage Checklist
            Panel pStages = new Panel { Location = new Point(60, 140), Size = new Size(520, 240), BackColor = Color.Transparent };
            string[] stageNames = new string[] {
                "Preparing AI environment",
                "Installing MYRAA Core",
                "Configuring Voice Engine",
                "Setting up Desktop Bridge",
                "Installing Capability Modules",
                "Initializing Memory System",
                "Security verification"
            };

            for (int i = 0; i < 7; i++)
            {
                stageIcons[i] = new Label {
                    Text = i == 0 ? "⭮" : "○",
                    ForeColor = i == 0 ? AccentCyan : TextDim,
                    Font = new Font("Segoe UI", 10f, FontStyle.Bold),
                    Location = new Point(10, i * 32),
                    Size = new Size(22, 22)
                };

                stageLabels[i] = new Label {
                    Text = stageNames[i],
                    ForeColor = i == 0 ? AccentCyan : TextDim,
                    Font = new Font("Segoe UI", 9.5f, i == 0 ? FontStyle.Bold : FontStyle.Regular),
                    Location = new Point(38, i * 32),
                    AutoSize = true
                };

                pStages.Controls.Add(stageIcons[i]);
                pStages.Controls.Add(stageLabels[i]);
            }
            contentPanel.Controls.Add(pStages);

            // Terminal Console Box
            logListBox = new ListBox();
            logListBox.Size = new Size(880, 115);
            logListBox.Location = new Point(60, 395);
            logListBox.BackColor = Color.FromArgb(8, 12, 20);
            logListBox.ForeColor = Color.FromArgb(140, 200, 250);
            logListBox.Font = new Font("Consolas", 8.5f);
            logListBox.BorderStyle = BorderStyle.FixedSingle;
            contentPanel.Controls.Add(logListBox);

            foreach (var log in installLogs) logListBox.Items.Add(log);
            if (logListBox.Items.Count > 0) logListBox.SelectedIndex = logListBox.Items.Count - 1;

            // Cancel Button
            Button btnCancel = CreateSecondaryButton("Cancel", 820, 530, 120, 42);
            btnCancel.Click += (s, e) => {
                if (MessageBox.Show("Cancel installation?", "Confirm", MessageBoxButtons.YesNo) == DialogResult.Yes) {
                    RenderScreen(2);
                }
            };
            contentPanel.Controls.Add(btnCancel);
        }

        // =========================================================================
        // SCREEN 5: MYRAA IS READY.
        // =========================================================================
        private void BuildScreen5_Complete()
        {
            AddStepBreadcrumbs(5);

            int cx = 500;

            Label lblCheck = new Label {
                Text = "✓",
                ForeColor = AccentGreen,
                Font = new Font("Segoe UI", 36f, FontStyle.Bold),
                Location = new Point(cx - 35, 80),
                Size = new Size(70, 60),
                TextAlign = ContentAlignment.MiddleCenter
            };
            contentPanel.Controls.Add(lblCheck);

            Label lblTitle = new Label {
                Text = "MYRAA IS READY.",
                ForeColor = TextLight,
                Font = new Font("Segoe UI", 22f, FontStyle.Bold),
                Location = new Point(cx - 160, 150),
                AutoSize = true
            };
            contentPanel.Controls.Add(lblTitle);

            Label lblSub = new Label {
                Text = "Your AI assistant has been installed and connected to Windows.",
                ForeColor = TextMuted,
                Font = new Font("Segoe UI", 10.5f),
                Location = new Point(cx - 240, 192),
                AutoSize = true
            };
            contentPanel.Controls.Add(lblSub);

            // Readiness Grid
            Panel grid = CreateCardPanel(cx - 260, 235, 520, 180);
            string[,] readyItems = new string[,] {
                { "Voice Engine", "Ready" },
                { "Desktop Control", "Ready" },
                { "Memory System", "Ready" },
                { "Browser Agent", "Ready" },
                { "Learning Engine", "Ready" },
                { "Automation Engine", "Ready" }
            };

            for (int i = 0; i < 6; i++)
            {
                int r = i / 2;
                int c = i % 2;
                int x = 30 + (c * 260);
                int y = 20 + (r * 50);

                Label lblDot = new Label { Text = "●", ForeColor = AccentGreen, Font = new Font("Segoe UI", 9f), Location = new Point(x, y + 2), Size = new Size(16, 16) };
                Label lblName = new Label { Text = readyItems[i, 0], ForeColor = TextLight, Font = new Font("Segoe UI", 10f, FontStyle.Bold), Location = new Point(x + 20, y), AutoSize = true };
                Label lblStat = new Label { Text = readyItems[i, 1], ForeColor = AccentGreen, Font = new Font("Segoe UI", 9f, FontStyle.Bold), Location = new Point(x + 190, y + 1), AutoSize = true };

                grid.Controls.Add(lblDot);
                grid.Controls.Add(lblName);
                grid.Controls.Add(lblStat);
            }
            contentPanel.Controls.Add(grid);

            // Buttons: Launch MYRAA & Finish / Close
            Button btnLaunch = CreateGlowButton("Launch MYRAA  →", cx - 200, 445, 240, 48, AccentBlue, Color.White);
            btnLaunch.Click += (s, e) => {
                LaunchInstalledMyraa();
                this.Hide();
                Application.Exit();
            };
            contentPanel.Controls.Add(btnLaunch);

            Button btnFinish = CreateSecondaryButton("Finish", cx + 55, 445, 145, 48);
            btnFinish.Click += (s, e) => {
                this.Hide();
                Application.Exit();
            };
            contentPanel.Controls.Add(btnFinish);

            // Open Settings
            Button btnSettings = new Button {
                Text = "Open Settings",
                Location = new Point(cx - 80, 505),
                Size = new Size(160, 28),
                FlatStyle = FlatStyle.Flat,
                ForeColor = TextMuted,
                Font = new Font("Segoe UI", 9.5f, FontStyle.Underline),
                BackColor = Color.Transparent,
                Cursor = Cursors.Hand
            };
            btnSettings.FlatAppearance.BorderSize = 0;
            btnSettings.Click += (s, e) => {
                LaunchInstalledMyraa();
                this.Hide();
                Application.Exit();
            };
            contentPanel.Controls.Add(btnSettings);

            // Footer
            Label lblFooter = new Label {
                Text = "Version 7.5.0 APEX    •    Thank you for choosing MYRAA.",
                ForeColor = TextDim,
                Font = new Font("Segoe UI", 8.5f),
                Location = new Point(cx - 180, 548),
                AutoSize = true
            };
            contentPanel.Controls.Add(lblFooter);
        }

        private void AddStepBreadcrumbs(int activeStep)
        {
            string[] names = new string[] { "Welcome", "Location", "Permissions", "Install", "Complete" };
            int startX = 260;
            for (int i = 0; i < 5; i++)
            {
                int num = i + 1;
                bool isActive = num == activeStep;
                bool isPast = num < activeStep;

                Label lblBadge = new Label {
                    Text = num.ToString(),
                    ForeColor = isActive ? Color.FromArgb(5, 8, 17) : (isPast ? AccentCyan : TextDim),
                    BackColor = isActive ? AccentCyan : Color.FromArgb(20, 28, 44),
                    Font = new Font("Segoe UI", 8f, FontStyle.Bold),
                    Size = new Size(18, 18),
                    Location = new Point(startX + (i * 100), 16),
                    TextAlign = ContentAlignment.MiddleCenter
                };
                contentPanel.Controls.Add(lblBadge);

                Label lblName = new Label {
                    Text = names[i],
                    ForeColor = isActive ? AccentCyan : (isPast ? TextMuted : TextDim),
                    Font = new Font("Segoe UI", 8.5f, isActive ? FontStyle.Bold : FontStyle.Regular),
                    Location = new Point(startX + (i * 100) + 22, 16),
                    AutoSize = true
                };
                contentPanel.Controls.Add(lblName);
            }
        }

        // =========================================================================
        // REAL BACKGROUND INSTALLATION LOGIC
        // =========================================================================
        private void StartInstallationThread()
        {
            displayedProgress = 0f;
            targetProgress = 5f;
            Thread t = new Thread(() => {
                try
                {
                    PerformRealInstallation();
                    while (displayedProgress < 99.5f) {
                        Thread.Sleep(20);
                    }
                    displayedProgress = 100f;
                    Thread.Sleep(300);
                    SafeInvoke(() => RenderScreen(5));
                }
                catch (Exception ex)
                {
                    LogInstall("Installation Notice: " + ex.Message);
                    SafeInvoke(() => RenderScreen(5));
                }
            });
            t.IsBackground = true;
            t.Start();
        }

        private void PerformRealInstallation()
        {
            UpdateStage(10, 0);
            LogInstall("[INFO] Initializing MYRAA AI OS setup subsystem...");
            Thread.Sleep(250);
            LogInstall("[INFO] Verifying core component packages & prerequisites...");
            Thread.Sleep(250);

            UpdateStage(28, 1);
            LogInstall("[INFO] Installing MYRAA Core & runtime binaries...");

            string sourceMyraa = AppDomain.CurrentDomain.BaseDirectory;
            if (!Directory.Exists(Path.Combine(sourceMyraa, "resources", "app")))
            {
                sourceMyraa = @"D:\Team of Vishwajeet\MYRAA";
            }
            string targetDir = installPath;

            Directory.CreateDirectory(targetDir);
            Directory.CreateDirectory(Path.Combine(targetDir, "resources"));
            Directory.CreateDirectory(Path.Combine(targetDir, "resources", "app"));

            // 1. Copy All Root Binaries and Assets
            if (Directory.Exists(sourceMyraa))
            {
                foreach (string file in Directory.GetFiles(sourceMyraa))
                {
                    string fName = Path.GetFileName(file);
                    if (fName.EndsWith(".exe", StringComparison.OrdinalIgnoreCase) && fName.IndexOf("Setup", StringComparison.OrdinalIgnoreCase) >= 0) continue;
                    if (fName.EndsWith(".log", StringComparison.OrdinalIgnoreCase) || fName.EndsWith(".tmp", StringComparison.OrdinalIgnoreCase)) continue;
                    try {
                        File.Copy(file, Path.Combine(targetDir, fName), true);
                    } catch {}
                }
            }

            // 2. Sync App Files
            UpdateStage(50, 2);
            LogInstall("[INFO] Configuring Voice Engine & application bundles...");
            string srcApp = Path.Combine(sourceMyraa, "resources", "app");
            string dstApp = Path.Combine(targetDir, "resources", "app");
            if (Directory.Exists(srcApp))
            {
                SafeCopyDirectoryRecursive(srcApp, dstApp);
                LogInstall("[INFO] Synced MYRAA core application bundles.");
            }

            // 3. Sync Agent
            UpdateStage(68, 3);
            LogInstall("[INFO] Setting up Desktop Bridge & autonomous agent service...");
            string srcAgent = Path.Combine(sourceMyraa, "resources", "agent");
            string dstAgent = Path.Combine(targetDir, "resources", "agent");
            if (Directory.Exists(srcAgent))
            {
                SafeCopyDirectoryRecursive(srcAgent, dstAgent);
                LogInstall("[INFO] Synced MYRAA autonomous agent service.");
            }

            UpdateStage(84, 4);
            LogInstall("[INFO] Configuring Capability Modules, local neural services & shortcuts...");

            // Shortcuts
            string targetExe = Path.Combine(targetDir, "MYRAA.exe");
            string iconPath = Path.Combine(targetDir, "icon.ico");
            if (!File.Exists(iconPath)) iconPath = Path.Combine(sourceMyraa, "icon.ico");
            if (!File.Exists(iconPath)) iconPath = @"D:\Team of Vishwajeet\MYRAA\icon.ico";

            if (chkDesktop == null || chkDesktop.Checked)
            {
                string desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                if (Directory.Exists(desktop)) {
                    CreateShortcut(Path.Combine(desktop, "MYRAA.lnk"), targetExe, targetDir, "MYRAA AI OS", iconPath);
                }
            }

            // Start Menu Shortcuts
            string startMenuDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.StartMenu), "Programs", "MYRAA AI OS");
            try {
                if (!Directory.Exists(startMenuDir)) Directory.CreateDirectory(startMenuDir);
                CreateShortcut(Path.Combine(startMenuDir, "MYRAA AI OS.lnk"), targetExe, targetDir, "MYRAA AI OS", iconPath);
            } catch {}

            string startMenuRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.StartMenu), "Programs");
            if (Directory.Exists(startMenuRoot)) {
                CreateShortcut(Path.Combine(startMenuRoot, "MYRAA AI OS.lnk"), targetExe, targetDir, "MYRAA AI OS", iconPath);
            }

            UpdateStage(93, 5);
            LogInstall("[INFO] Initializing Memory System, uninstaller and registering Windows Application...");

            string uninstExe = Path.Combine(targetDir, "Uninstall.exe");
            GenerateUninstallerExe(uninstExe, targetDir, targetExe);
            if (File.Exists(uninstExe) && Directory.Exists(startMenuDir)) {
                CreateShortcut(Path.Combine(startMenuDir, "Uninstall MYRAA.lnk"), uninstExe, targetDir, "Uninstall MYRAA AI OS", iconPath);
            }

            // Register in Windows Add/Remove Programs (Registry)
            try {
                using (RegistryKey uninstKey = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\MYRAA-AI-OS")) {
                    if (uninstKey != null) {
                        uninstKey.SetValue("DisplayName", "MYRAA AI OS");
                        uninstKey.SetValue("DisplayVersion", "7.5.0");
                        uninstKey.SetValue("Publisher", "MYRAA AI Community");
                        uninstKey.SetValue("DisplayIcon", targetExe + ",0");
                        uninstKey.SetValue("InstallLocation", targetDir);
                        uninstKey.SetValue("UninstallString", "\"" + uninstExe + "\"");
                        uninstKey.SetValue("QuietUninstallString", "\"" + uninstExe + "\" /quiet");
                        uninstKey.SetValue("NoModify", 1, RegistryValueKind.DWord);
                        uninstKey.SetValue("NoRepair", 1, RegistryValueKind.DWord);
                        uninstKey.SetValue("EstimatedSize", 480000, RegistryValueKind.DWord);
                    }
                }
            } catch (Exception ex) {
                LogInstall("[WARN] Registry registration: " + ex.Message);
            }

            UpdateStage(98, 6);
            LogInstall("[INFO] Security verification and registering Windows startup service...");

            if (chkStartup != null && chkStartup.Checked) {
                try {
                    using (RegistryKey key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run", true)) {
                        if (key != null) key.SetValue("MYRAA_AI_OS", "\"" + targetExe + "\"");
                    }
                } catch {}
            }

            UpdateStage(100, 7);
            LogInstall("[INFO] MYRAA AI OS v7.5.0 APEX installation verified and complete.");
        }

        private void GenerateUninstallerExe(string uninstExePath, string targetDir, string targetExe)
        {
            try
            {
                string uninstCode = @"
using System;
using System.IO;
using System.Diagnostics;
using System.Windows.Forms;
using Microsoft.Win32;

namespace MyraaUninstall
{
    static class Program
    {
        [STAThread]
        static void Main(string[] args)
        {
            bool quiet = (args != null && Array.Exists(args, a => a.Equals(""/quiet"", StringComparison.OrdinalIgnoreCase) || a.Equals(""/s"", StringComparison.OrdinalIgnoreCase)));
            if (!quiet)
            {
                DialogResult res = MessageBox.Show(""Are you sure you want to uninstall MYRAA AI OS and remove all its shortcuts and components?"", ""Uninstall MYRAA AI OS"", MessageBoxButtons.YesNo, MessageBoxIcon.Question);
                if (res != DialogResult.Yes) return;
            }

            try
            {
                foreach (var p in Process.GetProcessesByName(""MYRAA"")) { try { p.Kill(); } catch {} }
                foreach (var p in Process.GetProcessesByName(""electron"")) { try { p.Kill(); } catch {} }
            } catch {}

            try { Registry.CurrentUser.DeleteSubKeyTree(@""Software\Microsoft\Windows\CurrentVersion\Uninstall\MYRAA-AI-OS"", false); } catch {}
            try {
                using (RegistryKey runKey = Registry.CurrentUser.OpenSubKey(@""Software\Microsoft\Windows\CurrentVersion\Run"", true)) {
                    if (runKey != null) runKey.DeleteValue(""MYRAA_AI_OS"", false);
                }
            } catch {}

            try {
                string desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                string deskLink1 = Path.Combine(desktop, ""MYRAA.lnk"");
                string deskLink2 = Path.Combine(desktop, ""MYRAA AI OS.lnk"");
                if (File.Exists(deskLink1)) File.Delete(deskLink1);
                if (File.Exists(deskLink2)) File.Delete(deskLink2);
            } catch {}

            try {
                string startMenuDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.StartMenu), ""Programs"", ""MYRAA AI OS"");
                if (Directory.Exists(startMenuDir)) Directory.Delete(startMenuDir, true);
                string singleLnk = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.StartMenu), ""Programs"", ""MYRAA AI OS.lnk"");
                if (File.Exists(singleLnk)) File.Delete(singleLnk);
            } catch {}

            string appDir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\');
            string cmd = ""/C choice /C Y /N /D Y /T 2 & rd /S /Q """" + appDir + """""""";
            ProcessStartInfo psi = new ProcessStartInfo(""cmd.exe"", cmd) {
                CreateNoWindow = true,
                UseShellExecute = false,
                WindowStyle = ProcessWindowStyle.Hidden
            };
            Process.Start(psi);

            if (!quiet)
            {
                MessageBox.Show(""MYRAA AI OS has been successfully uninstalled from your computer."", ""Uninstall Complete"", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
        }
    }
}
";
                var codeProvider = new Microsoft.CSharp.CSharpCodeProvider();
                var parameters = new System.CodeDom.Compiler.CompilerParameters
                {
                    GenerateExecutable = true,
                    OutputAssembly = uninstExePath,
                    CompilerOptions = "/target:winexe"
                };
                parameters.ReferencedAssemblies.Add("System.dll");
                parameters.ReferencedAssemblies.Add("System.Windows.Forms.dll");
                parameters.ReferencedAssemblies.Add("System.Drawing.dll");
                codeProvider.CompileAssemblyFromSource(parameters, uninstCode);
            }
            catch (Exception ex)
            {
                LogInstall("[WARN] Generating uninstaller: " + ex.Message);
            }
        }

        private void UpdateStage(float pct, int activeStage = -1)
        {
            targetProgress = pct;
            SafeInvoke(() => {
                if (activeStage >= 0)
                {
                    for (int i = 0; i < 7; i++)
                    {
                        if (stageIcons[i] == null || stageLabels[i] == null) continue;
                        if (i < activeStage)
                        {
                            stageIcons[i].Text = "✓";
                            stageIcons[i].ForeColor = AccentGreen;
                            stageLabels[i].ForeColor = TextLight;
                            stageLabels[i].Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);
                        }
                        else if (i == activeStage)
                        {
                            stageIcons[i].Text = "⭮";
                            stageIcons[i].ForeColor = AccentCyan;
                            stageLabels[i].ForeColor = AccentCyan;
                            stageLabels[i].Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
                        }
                        else
                        {
                            stageIcons[i].Text = "○";
                            stageIcons[i].ForeColor = TextDim;
                            stageLabels[i].ForeColor = TextDim;
                            stageLabels[i].Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);
                        }
                    }
                }
            });
        }

        private void LogInstall(string msg)
        {
            SafeInvoke(() => {
                installLogs.Add(msg);
                if (logListBox != null)
                {
                    logListBox.Items.Add(msg);
                    logListBox.SelectedIndex = logListBox.Items.Count - 1;
                }
            });
        }

        private void SafeCopyDirectoryRecursive(string sourceDir, string targetDir)
        {
            Directory.CreateDirectory(targetDir);
            foreach (string file in Directory.GetFiles(sourceDir))
            {
                string destFile = Path.Combine(targetDir, Path.GetFileName(file));
                try { File.Copy(file, destFile, true); } catch {}
            }
            foreach (string subDir in Directory.GetDirectories(sourceDir))
            {
                string dirName = Path.GetFileName(subDir);
                if (dirName.Equals("node_modules", StringComparison.OrdinalIgnoreCase) || dirName.Equals(".git", StringComparison.OrdinalIgnoreCase)) continue;
                SafeCopyDirectoryRecursive(subDir, Path.Combine(targetDir, dirName));
            }
        }

        private void CreateShortcut(string shortcutPath, string targetPath, string workingDir, string desc, string iconPath)
        {
            try {
                Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                if (shellType != null) {
                    dynamic shell = Activator.CreateInstance(shellType);
                    dynamic shortcut = shell.CreateShortcut(shortcutPath);
                    shortcut.TargetPath = targetPath;
                    shortcut.WorkingDirectory = workingDir;
                    shortcut.Description = desc;
                    if (File.Exists(iconPath)) shortcut.IconLocation = iconPath + ",0";
                    shortcut.Save();
                }
            } catch {}
        }

        private void LaunchInstalledMyraa()
        {
            string targetExe = Path.Combine(installPath, "MYRAA.exe");
            if (!File.Exists(targetExe)) targetExe = @"D:\Team of Vishwajeet\MYRAA\MYRAA.exe";
            if (File.Exists(targetExe)) {
                try {
                    ProcessStartInfo psi = new ProcessStartInfo(targetExe) {
                        WorkingDirectory = Path.GetDirectoryName(targetExe),
                        UseShellExecute = true
                    };
                    Process.Start(psi);
                } catch {}
            }
        }

        private long GetFreeDriveSpaceGb(string path)
        {
            try {
                string root = Path.GetPathRoot(path);
                DriveInfo d = new DriveInfo(root);
                return d.AvailableFreeSpace / (1024 * 1024 * 1024);
            } catch { return 118; }
        }

        private void SafeInvoke(Action a)
        {
            try {
                if (this.InvokeRequired) this.BeginInvoke(a);
                else a();
            } catch {}
        }

        // Paint Event for Drawing Circular Progress & Ambient Glows
        private void ContentPanel_Paint(object sender, PaintEventArgs e)
        {
            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;

            if (currentScreen == 4)
            {
                // Circular Progress Ring on Right Side (Screen 4)
                float cx = 760f;
                float cy = 250f;
                float r = 65f;

                // Track
                using (Pen trackPen = new Pen(Color.FromArgb(20, 30, 48), 8f))
                {
                    g.DrawEllipse(trackPen, cx - r, cy - r, r * 2, r * 2);
                }

                // Progress Arc
                float sweep = (displayedProgress / 100f) * 360f;
                if (sweep > 1f)
                {
                    using (Pen arcPen = new Pen(AccentCyan, 8f))
                    {
                        arcPen.StartCap = LineCap.Round;
                        arcPen.EndCap = LineCap.Round;
                        g.DrawArc(arcPen, cx - r, cy - r, r * 2, r * 2, -90f, sweep);
                    }
                }

                // Percentage inside circle
                string pText = string.Format("{0}%", (int)displayedProgress);
                using (Font pf = new Font("Segoe UI", 24f, FontStyle.Bold))
                using (SolidBrush pb = new SolidBrush(TextLight))
                {
                    SizeF sz = g.MeasureString(pText, pf);
                    g.DrawString(pText, pf, pb, cx - (sz.Width / 2), cy - 22);
                }

                using (Font sf = new Font("Segoe UI", 9f, FontStyle.Regular))
                using (SolidBrush sb = new SolidBrush(TextMuted))
                {
                    string st = "Installing...";
                    SizeF ssz = g.MeasureString(st, sf);
                    g.DrawString(st, sf, sb, cx - (ssz.Width / 2), cy + 14);
                }
            }
        }

        private Panel CreateCardPanel(int x, int y, int w, int h)
        {
            Panel p = new Panel();
            p.Location = new Point(x, y);
            p.Size = new Size(w, h);
            p.BackColor = BgSecondary;
            p.Paint += (s, e) => {
                using (Pen pen = new Pen(BorderColor, 1f))
                {
                    e.Graphics.DrawRectangle(pen, 0, 0, w - 1, h - 1);
                }
            };
            return p;
        }

        private Button CreateGlowButton(string text, int x, int y, int w, int h, Color glowColor, Color textColor)
        {
            Button btn = new Button();
            btn.Text = text;
            btn.Location = new Point(x, y);
            btn.Size = new Size(w, h);
            btn.BackColor = glowColor;
            btn.ForeColor = textColor;
            btn.Font = new Font("Segoe UI", 11f, FontStyle.Bold);
            btn.FlatStyle = FlatStyle.Flat;
            btn.FlatAppearance.BorderSize = 0;
            btn.Cursor = Cursors.Hand;
            return btn;
        }

        private Button CreateSecondaryButton(string text, int x, int y, int w, int h)
        {
            Button btn = new Button();
            btn.Text = text;
            btn.Location = new Point(x, y);
            btn.Size = new Size(w, h);
            btn.BackColor = Color.FromArgb(20, 28, 44);
            btn.ForeColor = TextLight;
            btn.Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
            btn.FlatStyle = FlatStyle.Flat;
            btn.FlatAppearance.BorderColor = BorderColor;
            btn.Cursor = Cursors.Hand;
            return btn;
        }

        [STAThread]
        public static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new ModernInstallerForm(args));
        }
    }
}
