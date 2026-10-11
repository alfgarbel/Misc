<?php
/**
 * Plugin Name:       OGsmith Social Cards
 * Plugin URI:        https://ogsmith.app/blog/wordpress-og-image
 * Description:       Gives every post and page an Open Graph social card made from its own title, in your OGsmith brand colours.
 * Version:           1.0.0
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            OGsmith
 * Author URI:        https://ogsmith.app
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       ogsmith
 */

if (!defined('ABSPATH')) {
	exit;
}

const OGSMITH_OPTION = 'ogsmith_settings';
const OGSMITH_ENDPOINT = 'https://ogsmith.app/api/og';
const OGSMITH_TEMPLATES = array('gradient', 'minimal', 'split', 'terminal', 'quote', 'announce', 'link');

function ogsmith_settings() {
	$saved = get_option(OGSMITH_OPTION, array());
	return wp_parse_args(is_array($saved) ? $saved : array(), array(
		'account_id' => '',
		'secret'     => '',
		'api_key'    => '',
		'template'   => '',
		'front_page' => '1',
	));
}

/**
 * Percent-encodes exactly like JavaScript's encodeURIComponent, which is
 * what OGsmith's signature check uses. rawurlencode also encodes ! ' ( ) *,
 * so a title containing any of them would otherwise fail verification.
 */
function ogsmith_encode($value) {
	return strtr(rawurlencode($value), array(
		'%21' => '!',
		'%27' => "'",
		'%28' => '(',
		'%29' => ')',
		'%2A' => '*',
	));
}

/**
 * Builds the card URL. With an account id and signing secret the URL is
 * signed, so the secret never appears in the page; an API key is the
 * simpler alternative, but it is visible in the page source.
 *
 * @param array<string,string> $params
 */
function ogsmith_card_url(array $params, array $settings) {
	$params = array_filter($params, function ($v) {
		return $v !== '' && $v !== null;
	});

	if ($settings['account_id'] !== '' && $settings['secret'] !== '') {
		$params['acct'] = $settings['account_id'];
		$pairs = array();
		foreach ($params as $name => $value) {
			$pairs[] = array(ogsmith_encode((string) $name), ogsmith_encode((string) $value));
		}
		usort($pairs, function ($a, $b) {
			return $a[0] === $b[0] ? strcmp($a[1], $b[1]) : strcmp($a[0], $b[0]);
		});
		$query = implode('&', array_map(function ($p) {
			return $p[0] . '=' . $p[1];
		}, $pairs));
		return OGSMITH_ENDPOINT . '?' . $query . '&sig=' . hash_hmac('sha256', $query, $settings['secret']);
	}

	if ($settings['api_key'] !== '') {
		$params = array('key' => $settings['api_key']) + $params;
		$query = array();
		foreach ($params as $name => $value) {
			$query[] = ogsmith_encode((string) $name) . '=' . ogsmith_encode((string) $value);
		}
		return OGSMITH_ENDPOINT . '?' . implode('&', $query);
	}

	return null;
}

function ogsmith_clip($text, $max) {
	$text = trim(preg_replace('/\s+/u', ' ', wp_strip_all_tags(html_entity_decode((string) $text, ENT_QUOTES, 'UTF-8'))));
	if (function_exists('mb_strlen') && mb_strlen($text) > $max) {
		return rtrim(mb_substr($text, 0, $max - 1)) . '…';
	}
	return $text;
}

/** The card for the current request, or null where the plugin stays out. */
function ogsmith_current_card() {
	$settings = ogsmith_settings();

	if (is_singular()) {
		$post = get_queried_object();
		if (!$post instanceof WP_Post || post_password_required($post)) {
			return null;
		}
		$excerpt = has_excerpt($post) ? $post->post_excerpt : wp_trim_words(strip_shortcodes($post->post_content), 30, '…');
		$params = array(
			'title'    => ogsmith_clip(get_the_title($post), 200),
			'subtitle' => ogsmith_clip($excerpt, 300),
		);
	} elseif ((is_front_page() || is_home()) && $settings['front_page'] === '1') {
		$params = array(
			'title'    => ogsmith_clip(get_bloginfo('name'), 200),
			'subtitle' => ogsmith_clip(get_bloginfo('description'), 300),
		);
	} else {
		return null;
	}

	// Template, colours and site name come from the account's brand
	// defaults unless a template is chosen here.
	if (in_array($settings['template'], OGSMITH_TEMPLATES, true)) {
		$params['template'] = $settings['template'];
	}

	/**
	 * Filters the parameters sent to OGsmith for this page. Return an empty
	 * array to leave the page's existing tags alone.
	 */
	$params = apply_filters('ogsmith_card_params', $params);
	if (!is_array($params) || empty($params['title'])) {
		return null;
	}
	return ogsmith_card_url($params, $settings);
}

/*
 * SEO plugins and themes write their own og:image. Rather than learn every
 * plugin's API, wp_head is buffered and any image or card-type tags in it
 * are swapped for ours, so a page ends up with exactly one og:image.
 */
const OGSMITH_REPLACED_TAGS = '/[ \t]*<meta\b[^>]*\b(?:property|name)\s*=\s*["\'](?:og:image(?::[a-z_]+)?|twitter:image(?::[a-z_]+)?|twitter:card)["\'][^>]*>[ \t]*\n?/i';

$ogsmith_card = null;
$ogsmith_level = 0;

add_action('wp_head', function () {
	global $ogsmith_card, $ogsmith_level;
	$ogsmith_card = ogsmith_current_card();
	if ($ogsmith_card) {
		ob_start();
		$ogsmith_level = ob_get_level();
	}
}, PHP_INT_MIN);

add_action('wp_head', function () {
	global $ogsmith_card, $ogsmith_level;
	if (!$ogsmith_card || ob_get_level() !== $ogsmith_level) {
		return;
	}
	$head = preg_replace(OGSMITH_REPLACED_TAGS, '', ob_get_clean());
	$url = esc_attr($ogsmith_card);
	echo $head; // phpcs:ignore WordPress.Security.EscapeOutput -- other plugins' already-escaped head markup
	echo "<!-- OGsmith social card -->\n";
	echo '<meta property="og:image" content="' . $url . '" />' . "\n";
	echo '<meta property="og:image:width" content="1200" />' . "\n";
	echo '<meta property="og:image:height" content="630" />' . "\n";
	echo '<meta property="og:image:type" content="image/png" />' . "\n";
	echo '<meta name="twitter:card" content="summary_large_image" />' . "\n";
	echo '<meta name="twitter:image" content="' . $url . '" />' . "\n";
}, PHP_INT_MAX);

/* Settings → OGsmith */

add_action('admin_menu', function () {
	add_options_page('OGsmith', 'OGsmith', 'manage_options', 'ogsmith', 'ogsmith_settings_page');
});

add_filter('plugin_action_links_' . plugin_basename(__FILE__), function ($links) {
	array_unshift($links, '<a href="' . esc_url(admin_url('options-general.php?page=ogsmith')) . '">' . esc_html__('Settings', 'ogsmith') . '</a>');
	return $links;
});

add_action('admin_init', function () {
	register_setting('ogsmith', OGSMITH_OPTION, array(
		'type'              => 'array',
		'sanitize_callback' => function ($input) {
			$old = ogsmith_settings();
			$input = is_array($input) ? $input : array();
			$secret = trim((string) ($input['secret'] ?? ''));
			if (!empty($input['clear_secret'])) {
				$old['secret'] = '';
			}
			return array(
				'account_id' => sanitize_text_field($input['account_id'] ?? ''),
				// An empty secret field means "keep the saved one": it is never echoed back into the form.
				'secret'     => $secret === '' ? $old['secret'] : sanitize_text_field($secret),
				'api_key'    => sanitize_text_field($input['api_key'] ?? ''),
				'template'   => in_array($input['template'] ?? '', OGSMITH_TEMPLATES, true) ? $input['template'] : '',
				'front_page' => empty($input['front_page']) ? '0' : '1',
			);
		},
	));
});

function ogsmith_settings_page() {
	if (!current_user_can('manage_options')) {
		return;
	}
	$s = ogsmith_settings();
	$name = OGSMITH_OPTION;
	$preview = ogsmith_card_url(array('title' => get_bloginfo('name'), 'subtitle' => get_bloginfo('description')), $s);
	?>
	<div class="wrap">
		<h1>OGsmith social cards</h1>
		<p>Every post and page gets a social card made from its title and excerpt. Template, colours, site name and logo come from <a href="https://ogsmith.app/dashboard" target="_blank" rel="noopener">your OGsmith brand defaults</a>.</p>
		<form method="post" action="options.php">
			<?php settings_fields('ogsmith'); ?>
			<h2>Connect your account</h2>
			<p>Recommended: a signed URL, so no secret appears in your pages. Find both values in the OGsmith dashboard under <strong>Signed URLs</strong>.</p>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="ogsmith-account">Account ID</label></th>
					<td><input id="ogsmith-account" class="regular-text" name="<?php echo esc_attr($name); ?>[account_id]" value="<?php echo esc_attr($s['account_id']); ?>" autocomplete="off"></td>
				</tr>
				<tr>
					<th scope="row"><label for="ogsmith-secret">Signing secret</label></th>
					<td>
						<input id="ogsmith-secret" class="regular-text" type="password" name="<?php echo esc_attr($name); ?>[secret]" value="" autocomplete="new-password" placeholder="<?php echo $s['secret'] !== '' ? esc_attr__('Saved. Leave empty to keep it.', 'ogsmith') : ''; ?>">
						<?php if ($s['secret'] !== '') : ?>
							<p><label><input type="checkbox" name="<?php echo esc_attr($name); ?>[clear_secret]" value="1"> Remove the saved secret</label></p>
						<?php endif; ?>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="ogsmith-key">Or an API key</label></th>
					<td>
						<input id="ogsmith-key" class="regular-text" name="<?php echo esc_attr($name); ?>[api_key]" value="<?php echo esc_attr($s['api_key']); ?>" autocomplete="off" placeholder="og_…">
						<p class="description">Simpler, but the key is visible in your page source. Used only when no signing secret is set.</p>
					</td>
				</tr>
			</table>
			<h2>Cards</h2>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="ogsmith-template">Template</label></th>
					<td>
						<select id="ogsmith-template" name="<?php echo esc_attr($name); ?>[template]">
							<option value="">Brand default</option>
							<?php foreach (OGSMITH_TEMPLATES as $t) : ?>
								<option value="<?php echo esc_attr($t); ?>" <?php selected($s['template'], $t); ?>><?php echo esc_html(ucfirst($t)); ?></option>
							<?php endforeach; ?>
						</select>
						<p class="description"><a href="https://ogsmith.app/templates" target="_blank" rel="noopener">See the templates</a>.</p>
					</td>
				</tr>
				<tr>
					<th scope="row">Home page</th>
					<td><label><input type="checkbox" name="<?php echo esc_attr($name); ?>[front_page]" value="1" <?php checked($s['front_page'], '1'); ?>> Use the site name and tagline for the home page card</label></td>
				</tr>
			</table>
			<?php submit_button(); ?>
		</form>
		<?php if ($preview) : ?>
			<h2>Preview</h2>
			<p><img src="<?php echo esc_attr($preview); ?>" alt="" width="600" height="315" style="max-width:100%;height:auto;border:1px solid #dcdcde;border-radius:4px"></p>
			<p class="description">If the image doesn't load, check the Account ID and secret, or the API key.</p>
			<p>Then paste any post into the <a href="https://ogsmith.app/check" target="_blank" rel="noopener">link preview checker</a> to see it on X, LinkedIn, Slack and more.</p>
		<?php endif; ?>
	</div>
	<?php
}
