CREATE TRIGGER order_intents_updated_at
  BEFORE UPDATE ON order_intents FOR EACH ROW EXECUTE FUNCTION set_updated_at();
